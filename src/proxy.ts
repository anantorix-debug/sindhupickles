import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminAuthEnabled, readAdminToken } from "@/server/admin/session";

/**
 * Gatekeeper for everything administrative: the /admin pages and every /api route that isn't
 * part of the public store. The public storefront API (/api/store/*) and the admin sign-in
 * endpoints stay open. Admin handlers and layouts check the session again themselves.
 */
export function proxy(req: NextRequest) {
  if (!adminAuthEnabled()) return NextResponse.next();

  const path = req.nextUrl.pathname;
  const open = path.startsWith("/api/store/") || path.startsWith("/api/admin-auth/") || path === "/admin/login";
  if (open || readAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Admin sign-in required" } }, { status: 401 });
  }
  const login = new URL("/admin/login", req.url);
  login.searchParams.set("next", path);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/admin/:path*", "/api/:path*"] };
