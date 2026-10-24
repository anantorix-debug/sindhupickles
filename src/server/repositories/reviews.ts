import "server-only";
import type { Review } from "@/types";
import { notFound } from "@/server/http";
import { execute, iso, query } from "@/server/db";

export async function listReviews(): Promise<Review[]> {
  const rows = await query(
    `SELECT r.*, p.name AS product_name, c.name AS customer_name
     FROM reviews r JOIN products p ON p.id = r.product_id JOIN customers c ON c.id = r.customer_id
     ORDER BY r.created_at DESC, r.id DESC LIMIT 1000`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    productId: String(r.product_id),
    productName: r.product_name,
    customerId: String(r.customer_id),
    customerName: r.customer_name,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    visible: Boolean(r.is_visible),
    createdAt: iso(r.created_at)!,
  }));
}

export async function setReviewVisibility(id: string, visible: boolean): Promise<void> {
  const res = await execute("UPDATE reviews SET is_visible = ? WHERE id = ?", [visible ? 1 : 0, id]);
  if (res.affectedRows === 0) throw notFound("Review");
}

export async function deleteReview(id: string): Promise<void> {
  const res = await execute("DELETE FROM reviews WHERE id = ?", [id]);
  if (res.affectedRows === 0) throw notFound("Review");
}
