import "server-only";
import type { Review } from "@/types";
import { notFound } from "@/server/http";
import { execute, iso, query } from "@/server/db";

export async function listReviews(): Promise<Review[]> {
  const rows = await query(
    `SELECT r.*, p.name AS product_name, c.name AS customer_name
     FROM reviews r JOIN products p ON p.id = r.product_id JOIN customers c ON c.id = r.customer_id
     ORDER BY (r.status = 'PENDING') DESC, r.created_at DESC, r.id DESC LIMIT 1000`,
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
    status: String(r.status ?? "APPROVED").toLowerCase() === "pending" ? "pending" : "approved",
    createdAt: iso(r.created_at)!,
  }));
}

/** Keeps the product's star average and review count equal to its approved, visible reviews. */
async function refreshProductRating(productId: string | number): Promise<void> {
  await execute(
    `UPDATE products p SET
       rating_avg = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.product_id = p.id AND r.is_visible = 1 AND r.status = 'APPROVED'), 0),
       review_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.is_visible = 1 AND r.status = 'APPROVED')
     WHERE p.id = ?`,
    [productId],
  );
}

/** Show (which also approves a pending review) or hide a review. */
export async function setReviewVisibility(id: string, visible: boolean): Promise<void> {
  const [row] = await query("SELECT product_id FROM reviews WHERE id = ?", [id]);
  if (!row) throw notFound("Review");
  await execute(
    "UPDATE reviews SET is_visible = ?, status = IF(?, 'APPROVED', status), updated_at = NOW(3) WHERE id = ?",
    [visible ? 1 : 0, visible ? 1 : 0, id],
  );
  await refreshProductRating(row.product_id);
}

export async function deleteReview(id: string): Promise<void> {
  const [row] = await query("SELECT product_id FROM reviews WHERE id = ?", [id]);
  if (!row) throw notFound("Review");
  await execute("DELETE FROM reviews WHERE id = ?", [id]);
  await refreshProductRating(row.product_id);
}
