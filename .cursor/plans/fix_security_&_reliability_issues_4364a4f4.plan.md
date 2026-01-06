---
name: Fix security & reliability issues
overview: Harden TDLib storage paths and Telegram formatting, close DB handles, prevent scheduler overlap, and improve ingest/digest correctness without breaking core invariants (idempotent ingest, user scoping, timezone correctness).
todos:
  - id: tdlib-dir-userid
    content: Honor config.tdlibDataDir and validate/sanitize userId to prevent path traversal
    status: completed
  - id: telegram-markdownv2
    content: Switch sendDigest to MarkdownV2 with escaping; remove HTML fallback; add tests
    status: completed
    dependencies:
      - tdlib-dir-userid
  - id: db-close-handles
    content: Close SQLite DB handles in runDigest and runIngest via try/finally
    status: completed
  - id: scheduler-locking
    content: Add per-user locking to prevent overlapping ingest/digest runs
    status: completed
    dependencies:
      - db-close-handles
  - id: ingest-cursor-break
    content: Stop ingest paging once cursor boundary reached to improve efficiency
    status: completed
  - id: digest-grouping-timezone
    content: Group digest by chat_id and format times using config.timezone; update tests
    status: completed
---

# Fix Plan: src security & reliability

## Scope

Apply targeted fixes in backend `/home/cool/recaptel/src` based on the review findings:

- TDLib data dir correctness + path traversal protection
- Telegram digest sending: remove HTML fallback; use MarkdownV2 with escaping
- Close SQLite handles in long-running paths
- Prevent overlapping scheduler jobs
- Improve ingest paging efficiency and digest grouping/time formatting

## Changes (by area)

### 1) TDLib data directory + userId validation

- Update TDLib client creation to **honor** `config.tdlibDataDir` as the base directory: `<tdlibDataDir>/<userId>/`.
- Add strict validation for `userId` (CLI `--user`) to prevent path traversal and weird filesystem edge cases.
- Keep multi-user separation intact.

**Files**:

- [`/home/cool/recaptel/src/telegram/tdlib/client.ts`](/home/cool/recaptel/src/telegram/tdlib/client.ts)( /home/cool/recaptel/src/telegram/tdlib/client.ts )
- (If needed for CLI validation at the boundary) [`/home/cool/recaptel/src/index.ts`](/home/cool/recaptel/src/index.ts)( /home/cool/recaptel/src/index.ts )

### 2) Telegram digest sending: MarkdownV2 escaping, no HTML fallback

- Replace `parse_mode: "Markdown"` with **MarkdownV2**.
- Implement a small escape helper for MarkdownV2 and apply it to all outgoing digest parts.
- Remove HTML fallback entirely; fallback should be **plain text** if MarkdownV2 fails.

**Files**:

- [`/home/cool/recaptel/src/telegram/sendDigest.ts`](/home/cool/recaptel/src/telegram/sendDigest.ts)( /home/cool/recaptel/src/telegram/sendDigest.ts )
- Add/extend tests in [`/home/cool/recaptel/src/telegram/sendDigest.test.ts`](/home/cool/recaptel/src/telegram/sendDigest.test.ts)( /home/cool/recaptel/src/telegram/sendDigest.test.ts )

### 3) Close SQLite DB handles

- Ensure `initDb(...)` callers close the handle via `try/finally`.

**Files**:

- [`/home/cool/recaptel/src/digest/buildPrompt.ts`](/home/cool/recaptel/src/digest/buildPrompt.ts)( /home/cool/recaptel/src/digest/buildPrompt.ts )
- [`/home/cool/recaptel/src/telegram/tdlib/ingest.ts`](/home/cool/recaptel/src/telegram/tdlib/ingest.ts)( /home/cool/recaptel/src/telegram/tdlib/ingest.ts )

### 4) Prevent scheduler overlap

- Add an in-memory per-user mutex/flag to ensure:
- scheduled ingest does not overlap with itself
- digest run does not overlap with an ingest already running
- initial ingest respects the same lock

**Files**:

- [`/home/cool/recaptel/src/scheduler/cron.ts`](/home/cool/recaptel/src/scheduler/cron.ts)( /home/cool/recaptel/src/scheduler/cron.ts )

### 5) Ingest efficiency + digest correctness tweaks

- In ingest, stop paging older history once the cursor boundary is reached (typical TDLib ordering is newest → older).
- In digest building:
- group by `chat_id` (store/display title separately) to avoid title collisions
- format message times using `config.timezone` (Luxon is already available)

**Files**:

- [`/home/cool/recaptel/src/telegram/tdlib/ingest.ts`](/home/cool/recaptel/src/telegram/tdlib/ingest.ts)( /home/cool/recaptel/src/telegram/tdlib/ingest.ts )
- [`/home/cool/recaptel/src/digest/buildPrompt.ts`](/home/cool/recaptel/src/digest/buildPrompt.ts)( /home/cool/recaptel/src/digest/buildPrompt.ts )
- Update tests as needed in [`/home/cool/recaptel/src/digest/buildPrompt.test.ts`](/home/cool/recaptel/src/digest/buildPrompt.test.ts)( /home/cool/recaptel/src/digest/buildPrompt.test.ts )

## Validation

- Run existing unit tests (vitest) for touched modules.
- Add focused tests:
- MarkdownV2 escaping behavior (edge chars) and that we don’t send HTML.
- `userId` validation rejects traversal patterns.
- Digest grouping no longer collides on duplicate titles.