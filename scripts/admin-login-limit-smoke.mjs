// Admin sign-in throttle: only WRONG passwords count (10 per account), a correct sign-in resets the count, and
// guessing is still stopped. Uses throwaway admins that are removed afterwards. Start a FRESH server first (the
// limiter is in memory):  BASE=http://localhost:3113 node scripts/admin-login-limit-smoke.mjs
import mysql from "mysql2/promise";
import { createTestAdmin, password } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3113";
let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};
const login = async (email, pw) =>
  (await fetch(`${BASE}/api/admin-auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ email, password: pw }) })).status;

const db = await mysql.createConnection({ host: "localhost", user: "root", database: process.env.DB_NAME ?? "sindhu" });
const a = await createTestAdmin(db, BASE);
const b = await createTestAdmin(db, BASE);
try {
  check("throwaway admins can sign in", a.status === 200 && b.status === 200);

  const wrong5 = [];
  for (let i = 0; i < 5; i++) wrong5.push(await login(a.email, "wrong-password-" + i));
  check("5 wrong passwords are refused normally (401, not locked)", wrong5.every((s) => s === 401));
  check("then the right password works", (await login(a.email, password)) === 200);

  const wrong9 = [];
  for (let i = 0; i < 9; i++) wrong9.push(await login(a.email, "another-wrong-" + i));
  check("a correct sign-in cleared the count: 9 more wrong passwords still only 401", wrong9.every((s) => s === 401));
  check("and the right password still works after 9 failures", (await login(a.email, password)) === 200);

  const many = [];
  for (let i = 0; i < 15; i++) many.push(await login(a.email, password));
  check("signing in correctly 15 times in a row is never blocked", many.every((s) => s === 200));

  const guesses = [];
  for (let i = 0; i < 10; i++) guesses.push(await login(a.email, "guess-" + i));
  check("10 wrong guesses in a row are each refused with 401", guesses.every((s) => s === 401));
  check("the 11th attempt is blocked (429), even with the right password: brute force is stopped", (await login(a.email, password)) === 429);
  check("another account is not affected", (await login(b.email, password)) === 200);
} finally {
  await a.cleanup();
  await b.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
