// Forgot password without email (Admin -> Settings -> "Reset password without email check"): email + new password.
// Throwaway admin + customer, removed afterwards; the shop's settings are put back as they were.
//   BASE=http://localhost:3113 node scripts/direct-reset-smoke.mjs
import mysql from "mysql2/promise";
import { createTestAdmin } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3113";
// A fresh client address per run, so the per-address limit from an earlier run doesn't get in the way.
const IP = `10.${(Date.now() >> 16) & 255}.${(Date.now() >> 8) & 255}.${Date.now() & 255}`;
let failed = 0;
const check = (name, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };
const req = async (method, path, body, cookie = "") => {
  const res = await fetch(BASE + path, { method, headers: { Origin: BASE, "Content-Type": "application/json", "X-Forwarded-For": IP, ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, cookie: (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; "), json: await res.json().catch(() => null) };
};
const reset = (email, password, confirmPassword = password) => req("POST", "/api/store/auth/set-password", { email, password, confirmPassword });
const page = async () => (await fetch(`${BASE}/forgot-password`)).text();

const db = await mysql.createConnection({ host: "localhost", user: "root", database: process.env.DB_NAME ?? "sindhu" });
const admin = await createTestAdmin(db, BASE);
const email = `zz.direct.${Date.now()}@example.com`;
let customerId = null;
const original = (await req("GET", "/api/settings", null, admin.cookie)).json?.data;
const setSwitch = (on) => req("PUT", "/api/settings", { ...original, selfPasswordReset: on }, admin.cookie);
try {
  check("settings read", Boolean(original));
  check("owner switches it on", (await setSwitch(true)).json?.data?.selfPasswordReset === true);

  const reg = await req("POST", "/api/store/auth/register", { name: "Zz Direct", email, phone: "9876543210", password: "OldPassw0rd", confirmPassword: "OldPassw0rd" });
  customerId = reg.json?.data?.id;
  check("throwaway customer registered", reg.status === 201);

  const html = await page();
  check("forgot page shows email + new password + confirm", /type="email"/.test(html) && (html.match(/type="password"/g) ?? []).length === 2 && /Change password/.test(html));

  check("mismatched confirmation refused (422)", (await reset(email, "NewPassw0rd", "Different1")).status === 422);
  check("weak password refused (422)", (await reset(email, "short")).status === 422);
  const ghost = await reset(`zz.ghost.${Date.now()}@example.com`, "NewPassw0rd");
  check("unknown email -> 404 with a field message", ghost.status === 404 && Boolean(ghost.json?.error?.fields?.email ?? ghost.json?.fields?.email), JSON.stringify(ghost.json));

  check("password changed with just the email", (await reset(email.toUpperCase(), "NewPassw0rd")).status === 200);
  check("customer signs in with the NEW password", (await req("POST", "/api/store/auth/login", { email, password: "NewPassw0rd" })).status === 200);
  check("the OLD password no longer works", (await req("POST", "/api/store/auth/login", { email, password: "OldPassw0rd" })).status === 401);

  check("2nd change for the same email ok", (await reset(email, "Second1pass")).status === 200);
  check("3rd change for the same email ok", (await reset(email, "Third1pass")).status === 200);
  check("4th change for the same email within the hour is limited (429)", (await reset(email, "Fourth1pass")).status === 429);
  check("limited attempt did not change it", (await req("POST", "/api/store/auth/login", { email, password: "Third1pass" })).status === 200);

  check("owner switches it off", (await setSwitch(false)).json?.data?.selfPasswordReset === false);
  check("switched off: the API refuses (403)", (await reset(email, "Another1pass")).status === 403);
  check("switched off: the page no longer shows the password form", !/type="password"/.test(await page()));
} finally {
  if (original) await req("PUT", "/api/settings", original, admin.cookie);
  if (customerId) await db.query("DELETE FROM customers WHERE id = ?", [customerId]);
  await admin.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
