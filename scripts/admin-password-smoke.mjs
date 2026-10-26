// Admin -> Customers -> "Set new password" (the no-email way to help a customer who forgot their password).
// Throwaway admin + customer, removed afterwards.   BASE=http://localhost:3113 node scripts/admin-password-smoke.mjs
import mysql from "mysql2/promise";
import { createTestAdmin } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3113";
let failed = 0;
const check = (name, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };
const req = async (method, path, body, cookie = "") => {
  const res = await fetch(BASE + path, { method, headers: { Origin: BASE, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, cookie: (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; "), json: await res.json().catch(() => null) };
};

const db = await mysql.createConnection({ host: "localhost", user: "root", database: process.env.DB_NAME ?? "sindhu" });
const admin = await createTestAdmin(db, BASE);
const email = `zz.pw.${Date.now()}@example.com`;
let customerId = null;
try {
  const reg = await req("POST", "/api/store/auth/register", { name: "Zz Forgetful", email, phone: "9876543210", password: "OldPassw0rd", confirmPassword: "OldPassw0rd" });
  customerId = reg.json?.data?.id;
  check("throwaway customer registered", reg.status === 201);

  const path = `/api/customers/${customerId}/password`;
  check("mismatched confirmation refused (422)", (await req("PUT", path, { password: "NewPassw0rd", confirmPassword: "Different1" }, admin.cookie)).status === 422);
  check("weak password refused (422)", (await req("PUT", path, { password: "short", confirmPassword: "short" }, admin.cookie)).status === 422);
  check("a customer (not an admin) can't use it (401)", (await req("PUT", path, { password: "Hacked1234", confirmPassword: "Hacked1234" }, reg.cookie)).status === 401);
  check("signed-out visitor can't use it (401)", (await req("PUT", path, { password: "Hacked1234", confirmPassword: "Hacked1234" })).status === 401);
  check("unknown customer -> 404", (await req("PUT", `/api/customers/99999999/password`, { password: "NewPassw0rd", confirmPassword: "NewPassw0rd" }, admin.cookie)).status === 404);

  const set = await req("PUT", path, { password: "NewPassw0rd", confirmPassword: "NewPassw0rd" }, admin.cookie);
  check("admin sets the new password", set.status === 200);
  check("customer signs in with the NEW password", (await req("POST", "/api/store/auth/login", { email, password: "NewPassw0rd" })).status === 200);
  check("the OLD password no longer works", (await req("POST", "/api/store/auth/login", { email, password: "OldPassw0rd" })).status === 401);

  // With "Reset password without email check" switched on, the forgot page shows that form instead (direct-reset-smoke.mjs).
  const direct = (await req("GET", "/api/settings", null, admin.cookie)).json?.data?.selfPasswordReset;
  if (!direct) {
    const page = await (await fetch(`${BASE}/forgot-password`)).text();
    const smtp = Boolean(process.env.SMTP_HOST);
    check(smtp ? "forgot page shows the email form (SMTP configured)" : "forgot page (no email server) tells customers to call the shop, with the phone number", smtp ? /type="email"/.test(page) : /tel:/.test(page) && /set a new password for you/.test(page));
    check("forgot page offers no password form while the switch is off", !/type="password"/.test(page));
  }
} finally {
  if (customerId) await db.query("DELETE FROM customers WHERE id = ?", [customerId]);
  await admin.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
