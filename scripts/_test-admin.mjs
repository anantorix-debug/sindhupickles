// Test helper: creates a throwaway admin user, signs in through the real endpoint, and returns the
// session cookie plus a cleanup function. Never touches the real admin accounts.
import { randomBytes, scrypt } from "node:crypto";

export const password = "Zz-Test-Admin-1";

async function hash(pw) {
  const salt = randomBytes(16);
  const key = await new Promise((res, rej) => scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
  return `s1$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function createTestAdmin(db, base) {
  const email = `zz.admin.${Date.now()}@example.com`;
  const [res] = await db.query(
    "INSERT INTO users (email, password_hash, name, role, active, created_at, updated_at) VALUES (?, ?, 'ZZ Test Admin', 'MANAGER', 1, NOW(3), NOW(3))",
    [email, await hash(password)],
  );
  const login = await fetch(`${base}/api/admin-auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("sindhu_admin=")) ?? "";
  return {
    id: res.insertId,
    email,
    cookie,
    status: login.status,
    cleanup: () => db.query("DELETE FROM users WHERE id = ?", [res.insertId]),
  };
}
