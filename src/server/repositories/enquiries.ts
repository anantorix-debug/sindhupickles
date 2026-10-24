import "server-only";
import type { Enquiry } from "@/types";
import { notFound } from "@/server/http";
import { execute, iso, query } from "@/server/db";

export async function listEnquiries(): Promise<Enquiry[]> {
  const rows = await query("SELECT * FROM enquiries ORDER BY created_at DESC, id DESC LIMIT 1000");
  return rows.map((e) => ({
    id: String(e.id),
    name: e.name,
    email: e.email,
    phone: e.phone,
    message: e.message,
    isRead: Boolean(e.is_read),
    createdAt: iso(e.created_at)!,
  }));
}

export async function setEnquiryRead(id: string, isRead: boolean): Promise<void> {
  const res = await execute("UPDATE enquiries SET is_read = ? WHERE id = ?", [isRead ? 1 : 0, id]);
  if (res.affectedRows === 0) throw notFound("Enquiry");
}

export async function deleteEnquiry(id: string): Promise<void> {
  const res = await execute("DELETE FROM enquiries WHERE id = ?", [id]);
  if (res.affectedRows === 0) throw notFound("Enquiry");
}

/** Submitted from the storefront contact form; shows up in Admin → Enquiries. */
export async function createEnquiry(input: { name: string; email: string; phone: string | null; message: string }): Promise<void> {
  await execute("INSERT INTO enquiries (name, email, phone, message) VALUES (?, ?, ?, ?)", [input.name, input.email, input.phone, input.message]);
}
