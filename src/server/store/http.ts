import "server-only";
import type { NextRequest } from "next/server";
import { ApiError, route } from "@/server/http";
import { getSessionCustomerId } from "@/server/store/session";

type Ctx = { params: Promise<Record<string, string>> };

/**
 * Browsers always send `Origin` on cross-site writes; reject any state-changing
 * request whose Origin isn't this site (defence in depth on top of SameSite=Lax).
 */
function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser client
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) throw new ApiError(403, "Cross-site request blocked", "bad_origin");
}

/** Route wrapper for the public store API: consistent errors + same-origin check. */
export function storeRoute(fn: (req: NextRequest, ctx: Ctx) => Promise<Response>) {
  return route(async (req, ctx) => {
    assertSameOrigin(req);
    return fn(req, ctx);
  });
}

/** The signed-in customer's id. Customer-scoped endpoints must use this, never an id from the client. */
export async function requireCustomer(): Promise<string> {
  const id = await getSessionCustomerId();
  if (!id) throw new ApiError(401, "Please sign in to continue", "unauthenticated");
  return id;
}
