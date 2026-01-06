import { createInterface } from "readline";
import type { Config } from "../../config.js";
import { getOrCreateClient, removeClientFromCache, type TdlibClientWrapper, type AuthorizationState } from "./client.js";

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function waitForAuthState(
  wrapper: TdlibClientWrapper,
  ...targetStates: AuthorizationState[]
): Promise<AuthorizationState> {
  const maxWait = 60000;
  const interval = 200;
  let waited = 0;

  while (waited < maxWait) {
    const state = await wrapper.getAuthState();
    if (targetStates.includes(state)) {
      return state;
    }
    await new Promise((r) => setTimeout(r, interval));
    waited += interval;
  }

  throw new Error(`Timeout waiting for auth state. Current: ${await wrapper.getAuthState()}`);
}

export async function runTdlibLogin(config: Config, userId: string): Promise<void> {
  console.log(`Starting TDLib login for user: ${userId}`);
  console.log("You will need your phone number and will receive a code.\n");

  const wrapper = await getOrCreateClient(config, userId);

  let state = await wrapper.getAuthState();
  console.log(`Initial auth state: ${state}`);

  if (state === "authorizationStateWaitTdlibParameters") {
    state = await waitForAuthState(
      wrapper,
      "authorizationStateWaitPhoneNumber",
      "authorizationStateReady"
    );
  }

  if (state === "authorizationStateReady") {
    console.log("\nAlready logged in!");
    return;
  }

  if (state === "authorizationStateWaitPhoneNumber") {
    const phone = await prompt("Enter your phone number (with country code): ");
    await wrapper.sendPhoneNumber(phone);
    state = await waitForAuthState(wrapper, "authorizationStateWaitCode", "authorizationStateWaitPassword", "authorizationStateReady");
  }

  if (state === "authorizationStateWaitCode") {
    const code = await prompt("Enter the code you received: ");
    await wrapper.sendCode(code);
    state = await waitForAuthState(wrapper, "authorizationStateWaitPassword", "authorizationStateReady");
  }

  if (state === "authorizationStateWaitPassword") {
    const password = await prompt("Enter your 2FA password: ");
    await wrapper.sendPassword(password);
    state = await waitForAuthState(wrapper, "authorizationStateReady");
  }

  if (state === "authorizationStateReady") {
    console.log("\nLogin successful!");
    console.log(`TDLib data stored in: ${config.tdlibDataDir}/${userId}/`);
  } else {
    console.error(`Unexpected auth state: ${state}`);
  }
}

export async function checkAuthStatus(config: Config, userId: string): Promise<AuthorizationState> {
  const wrapper = await getOrCreateClient(config, userId);
  await new Promise((r) => setTimeout(r, 1000));
  return wrapper.getAuthState();
}

export async function logoutUser(config: Config, userId: string): Promise<void> {
  const wrapper = await getOrCreateClient(config, userId);
  await wrapper.client.invoke({ _: "logOut" });
  await wrapper.close();
  removeClientFromCache(userId);
  console.log(`Logged out user: ${userId}`);
}

