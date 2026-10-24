import "server-only";
import type { AdminUser } from "@/types";
import { ApiError } from "@/server/http";
import { execute, query } from "@/server/db";
import { DUMMY_ADMIN_HASH, verifyAdminPassword } from "@/server/admin/password";
import { adminAuthEnabled, getAdminSessionId } from "@/server/admin/session";

const mapUser = (r: { id: number; name: string; email: string; role: string }): AdminUser => ({
  id: String(r.id),
  name: r.name,
  email: r.email,
  role: String(r.role).toLowerCase(),
});

export async function loginAdmin(email: string, password: string): Promise<AdminUser> {
  const [u] = await query("SELECT id, name, email, role, password_hash FROM users WHERE email = ? AND active = 1", [email]);
  // Always do a hash comparison so timing doesn't reveal whether the account exists.
  const ok = await verifyAdminPassword(password, u?.password_hash ?? DUMMY_ADMIN_HASH);
  if (!u || !ok) throw new ApiError(401, "Incorrect email or password", "invalid_credentials");
  await execute("UPDATE users SET last_login_at = NOW(3) WHERE id = ?", [u.id]);
  return mapUser(u as never);
}

export async function getAdminById(id: string): Promise<AdminUser | null> {
  const [u] = await query("SELECT id, name, email, role FROM users WHERE id = ? AND active = 1", [id]);
  return u ? mapUser(u as never) : null;
}

/** The signed-in admin, or null. */
export async function getSignedInAdmin(): Promise<AdminUser | null> {
  const id = await getAdminSessionId();
  return id ? getAdminById(id) : null;
}

/** For admin API handlers (defence in depth behind the proxy). */
export async function requireAdmin(): Promise<void> {
  if (!adminAuthEnabled()) return;
  if (!(await getSignedInAdmin())) throw new ApiError(401, "Admin sign-in required", "unauthenticated");
}
