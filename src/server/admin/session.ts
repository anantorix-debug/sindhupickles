import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Admin session: a signed, httpOnly cookie, completely separate from the customer session
 * (different cookie name AND a different signing context), so a customer token can never be
 * accepted as an admin one. The proxy (src/proxy.ts) and `adminRoute` both verify it.
 */
export const ADMIN_COOKIE = "sindhu_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12;

/** Emergency switch for local development only. Never set this on a deployed site. */
export const adminAuthEnabled = () => process.env.ADMIN_AUTH !== "off";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters");
  return s;
}

const sign = (payload: string) => createHmac("sha256", `admin:${secret()}`).update(payload).digest("base64url");

export function createAdminToken(adminId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ aid: adminId, exp: now + MAX_AGE_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the admin user id if the token is genuine and unexpired. Pure, so the proxy can call it. */
export function readAdminToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { aid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { aid: string; exp: number };
    return typeof aid === "string" && /^\d{1,18}$/.test(aid) && exp > now ? aid : null;
  } catch {
    return null;
  }
}

export async function getAdminSessionId(): Promise<string | null> {
  return readAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function startAdminSession(adminId: string): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, createAdminToken(adminId), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}
