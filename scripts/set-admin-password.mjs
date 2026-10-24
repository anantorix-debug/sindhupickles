// Sets (or resets) an admin user's password. Run it yourself:
//
//   set NEW_PASSWORD=your-new-password            (PowerShell: $env:NEW_PASSWORD="...")
//   node scripts/set-admin-password.mjs admin@sindhuspickles.com
//
// Use this if you can't sign in to the admin (e.g. the stored password isn't known). It only updates
// `users.password_hash` for the one email you give. The password is read from the environment so it
// doesn't end up in your shell history.
import { randomBytes, scrypt } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}

const email = process.argv[2]?.toLowerCase();
const password = process.env.NEW_PASSWORD;
if (!email || !password) {
  console.error("Usage: NEW_PASSWORD=... node scripts/set-admin-password.mjs <email>");
  process.exit(1);
}
if (password.length < 10) {
  console.error("Choose a password of at least 10 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await new Promise((res, rej) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
const hash = `s1$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;

const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? "sindhu",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
});
const [res] = await db.query("UPDATE users SET password_hash = ?, updated_at = NOW(3) WHERE email = ?", [hash, email]);
await db.end();
console.log(res.affectedRows ? `Password updated for ${email}.` : `No admin user found with email ${email}.`);
