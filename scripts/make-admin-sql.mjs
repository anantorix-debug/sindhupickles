// Prints ONE SQL statement that creates (or resets) an admin login. It never connects to a database:
// paste the output into phpMyAdmin -> SQL on the live database. Only the password HASH is printed.
//
//   PowerShell:  $env:NEW_PASSWORD="your-long-password"; node scripts/make-admin-sql.mjs you@example.com "Your Name"
//   bash:        NEW_PASSWORD='your-long-password' node scripts/make-admin-sql.mjs you@example.com "Your Name"
import { randomBytes, scrypt } from "node:crypto";

const email = process.argv[2]?.trim().toLowerCase();
const name = process.argv[3]?.trim() || "Owner";
const password = process.env.NEW_PASSWORD;
if (!email || !/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(email) || !password) {
  console.error('Usage: NEW_PASSWORD=... node scripts/make-admin-sql.mjs <email> ["Name"]');
  process.exit(1);
}
if (password.length < 10) {
  console.error("Choose a password of at least 10 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await new Promise((res, rej) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
const hash = `s1$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

console.log(
  `INSERT INTO users (email, password_hash, name, role, active) VALUES (${q(email)}, ${q(hash)}, ${q(name)}, 'OWNER', 1)\n` +
    `ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name), role = 'OWNER', active = 1;`,
);
