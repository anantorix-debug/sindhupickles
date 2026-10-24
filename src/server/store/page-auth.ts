import "server-only";
import { redirect } from "next/navigation";
import type { CustomerProfile } from "@/types/store";
import { getProfile } from "@/server/store/customer-auth";
import { getSessionCustomerId } from "@/server/store/session";

/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
export const safeNext = (next: string | undefined, fallback = "/account") =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;

/** For pages that need a signed-in customer; sends visitors to /login and back. */
export async function requireCustomerPage(returnTo: string): Promise<CustomerProfile> {
  const id = await getSessionCustomerId();
  const profile = id ? await getProfile(id) : null;
  if (!profile) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return profile;
}

export async function redirectIfSignedIn(to: string): Promise<void> {
  const id = await getSessionCustomerId();
  if (id && (await getProfile(id))) redirect(to);
}
