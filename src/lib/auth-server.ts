import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { headers } from "next/headers";
import { db } from "@/db";
import { account, jwks, session, user, verification } from "@/db/schema";

export const auth = betterAuth({
  appName: "My App",
  baseURL: process.env.SITE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, jwks },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
});

export const handler = toNextJsHandler(auth);

export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}
