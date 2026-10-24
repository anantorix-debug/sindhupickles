import "server-only";
import { redirect } from "next/navigation";
import type { AdminUser } from "@/types";
import { query } from "@/server/db";
import { getSignedInAdmin } from "@/server/admin/auth";
import { adminAuthEnabled } from "@/server/admin/session";

/**
 * The signed-in admin. Admin pages redirect to the sign-in page when there is no session.
 * (With ADMIN_AUTH=off — a local-development escape hatch — the store owner is shown instead.)
 */
export async function getCurrentAdmin(): Promise<AdminUser> {
  const admin = await getSignedInAdmin();
  if (admin) return admin;
  if (adminAuthEnabled()) redirect("/admin/login");

  const [row] = await query("SELECT id, name, email, role FROM users WHERE active = 1 ORDER BY (role = 'OWNER') DESC, id LIMIT 1");
  return row
    ? { id: String(row.id), name: row.name, email: row.email, role: String(row.role).toLowerCase() }
    : { id: "0", name: "Admin", email: "", role: "admin" };
}
