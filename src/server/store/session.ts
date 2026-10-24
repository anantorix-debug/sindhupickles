import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Customer session: a signed, httpOnly cookie. This is deliberately separate from
 * any admin session (different cookie name and payload) so a customer can never
 * be mistaken for an admin.
 */
export const SESSION_COOKIE = "sindhu_customer";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters");
  }
  return s;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionToken(customerId: string, now = Date.now()): string {
  const payload = b64(JSON.stringify({ cid: customerId, exp: now + MAX_AGE_SECONDS * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { cid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { cid: string; exp: number };
    return typeof cid === "string" && /^\d{1,18}$/.test(cid) && exp > now ? cid : null;
  } catch {
    return null;
  }
}

export async function getSessionCustomerId(): Promise<string | null> {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function startSession(customerId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(customerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
