import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import { db } from "@/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/db/schema";
import { getAuthSecret, getResendKey } from "@/lib/secrets";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getAuthSecret(),
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  trustHost: true,
  providers: [
    Resend({
      apiKey: getResendKey(),
      from: process.env.AUTH_EMAIL_FROM || "RecapTel <onboarding@resend.dev>",
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
