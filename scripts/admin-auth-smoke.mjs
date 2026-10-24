// Checks that the admin area and admin API are locked down, and that sign-in/out works.
// Uses a throwaway admin user (removed afterwards).
import mysql from "mysql2/promise";
import { createTestAdmin, password } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3111";
let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};
const req = (path, { method = "GET", cookie = "", body, headers = {} } = {}) =>
  fetch(BASE + path, { method, redirect: "manual", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });

const db = await mysql.createConnection({ host: "localhost", user: "root", database: "sindhu", timezone: "Z" });
const admin = await createTestAdmin(db, BASE);
try {
  check("test admin can sign in", admin.status === 200 && admin.cookie.startsWith("sindhu_admin="));

  // --- locked when signed out
  const page = await req("/admin/dashboard");
  check("admin page redirects to sign-in", page.status === 307 && page.headers.get("location")?.includes("/admin/login?next=%2Fadmin%2Fdashboard"));
  for (const p of ["/api/products", "/api/orders", "/api/customers", "/api/payments", "/api/inventory", "/api/settings", "/api/dashboard", "/api/blog", "/api/enquiries"]) {
    check(`GET ${p} requires sign-in`, (await req(p)).status === 401);
  }
  check("POST /api/products requires sign-in", (await req("/api/products", { method: "POST", body: {} })).status === 401);
  check("DELETE /api/products/1 requires sign-in", (await req("/api/products/1", { method: "DELETE" })).status === 401);
  check("PATCH order status requires sign-in", (await req("/api/orders/1", { method: "PATCH", body: { status: "shipped" } })).status === 401);
  check("upload requires sign-in", (await req("/api/upload", { method: "POST" })).status === 401);

  // --- stays open: public site + the sign-in page
  for (const p of ["/", "/shop", "/api/store/products", "/api/store/categories", "/admin/login", "/uploads/products/none.png"]) {
    const s = (await req(p)).status;
    check(`${p} stays public`, s === 200 || s === 404, String(s));
  }

  // --- credentials
  const bad = await req("/api/admin-auth/login", { method: "POST", body: { email: admin.email, password: "wrong-password" } });
  check("wrong password rejected", bad.status === 401 && !bad.headers.getSetCookie?.().length);
  const unknown = await req("/api/admin-auth/login", { method: "POST", body: { email: "nobody@example.com", password } });
  check("unknown user: same error", unknown.status === 401 && (await unknown.json()).error.message === "Incorrect email or password");
  check("cross-site sign-in blocked", (await req("/api/admin-auth/login", { method: "POST", body: { email: admin.email, password }, headers: { Origin: "http://evil.example" } })).status === 403);

  // --- signed in
  check("signed-in: API works", (await req("/api/products", { cookie: admin.cookie })).status === 200);
  check("signed-in: admin page works", (await req("/admin/dashboard", { cookie: admin.cookie })).status === 200);
  check("signed-in: /admin/login bounces to dashboard", (await req("/admin/login", { cookie: admin.cookie })).status === 307);
  check("tampered cookie rejected", (await req("/api/products", { cookie: admin.cookie.slice(0, -3) + "xyz" })).status === 401);
  check("garbage cookie rejected", (await req("/api/products", { cookie: "sindhu_admin=abc.def" })).status === 401);

  // --- customer and admin sessions are separate
  const customerLogin = await req("/api/store/auth/register", { method: "POST", body: { name: "Zz Cust", email: `zz.cust.${Date.now()}@example.com`, phone: "9876543210", password: "Passw0rdOne", confirmPassword: "Passw0rdOne" } });
  const custCookie = (customerLogin.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("sindhu_customer=")) ?? "";
  const custId = (await customerLogin.json()).data?.id;
  check("customer session does NOT grant admin access", (await req("/api/products", { cookie: custCookie })).status === 401);
  check("customer token re-labelled as admin cookie is rejected", (await req("/api/products", { cookie: custCookie.replace("sindhu_customer=", "sindhu_admin=") })).status === 401);
  if (custId) await db.query("DELETE FROM customers WHERE id = ?", [custId]);

  // --- sign out
  const out = await req("/api/admin-auth/logout", { method: "POST", cookie: admin.cookie, body: {} });
  check("sign out clears the cookie", out.status === 200 && /sindhu_admin=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(out.headers.getSetCookie().join(";")));
  check("after sign-out the API is locked again", (await req("/api/products")).status === 401);
} finally {
  await admin.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
