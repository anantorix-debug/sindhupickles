// Customer reviews: only buyers whose order was DELIVERED can review, once per product; reviews wait for approval;
// approving/hiding/deleting keeps the product's star average and count right. Uses throwaway "zz" data, removed afterwards.
//   BASE=http://localhost:3113 node scripts/review-smoke.mjs      (server must have ENABLE_TEST_PAYMENTS=true)
import mysql from "mysql2/promise";
import { createTestAdmin } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3113";
let failed = 0;
const check = (name, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };

class Client {
  cookie = "";
  async call(method, path, body) {
    const res = await fetch(BASE + path, { method, headers: { Origin: BASE, ...(body ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() ?? []) this.cookie = [this.cookie, c.split(";")[0]].filter(Boolean).join("; ");
    return { status: res.status, json: await res.json().catch(() => null) };
  }
}
const db = await mysql.createConnection({ host: "localhost", user: "root", database: process.env.DB_NAME ?? "sindhu" });
const one = async (sql, p = []) => (await db.query(sql, p))[0][0];
const admin = new Client();
const t = await createTestAdmin(db, BASE);
admin.cookie = t.cookie;
const stamp = Date.now();
const made = { product: null, customers: [], orders: [] };
const buyer = new Client(), other = new Client(), visitor = new Client();

try {
  // a throwaway product with stock
  const cat = await one("SELECT id FROM categories WHERE parent_id IS NULL ORDER BY id LIMIT 1");
  const prod = await admin.call("POST", "/api/products", { name: `ZZ Review Pickle ${stamp}`, slug: `zz-review-pickle-${stamp}`, sku: `ZZ-REV-${stamp}`, categoryId: Number(cat.id), subcategoryId: null, price: 150, salePrice: null, status: "active", featured: false, spiceLevel: 0, shortDescription: "x", description: "Throwaway product for the review test." });
  made.product = prod.json?.data?.id;
  const slug = prod.json?.data?.slug;
  const variantId = prod.json?.data?.variants?.[0]?.id;
  await admin.call("PATCH", `/api/inventory/${variantId}`, { onHand: 10, reason: "review test" });

  // two customers: one will buy, one won't
  for (const [c, tag] of [[buyer, "buyer"], [other, "other"]]) {
    const r = await c.call("POST", "/api/store/auth/register", { name: `Zz ${tag}`, email: `zz.review.${tag}.${stamp}@example.com`, phone: "9876543210", password: "Passw0rdOne", confirmPassword: "Passw0rdOne" });
    made.customers.push(r.json?.data?.id);
  }
  const addr = (await buyer.call("POST", "/api/store/addresses", { type: "Home", fullName: "Zz Buyer", phone: "9876543210", line1: "1 Test Street", line2: "", area: "Anna Nagar", city: "Salem", district: "Salem", state: "Tamil Nadu", pincode: "636030", landmark: "", isDefault: true })).json?.data?.id;
  const review = { productSlug: slug, rating: 4, title: "Tasty", comment: "Lovely tangy pickle, just the right spice." };

  check("signed-out visitor can't review (401)", (await visitor.call("POST", "/api/store/reviews", review)).status === 401);
  check("signed-in customer who never bought it is refused (403)", (await other.call("POST", "/api/store/reviews", review)).status === 403);

  const order = await buyer.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 1 }], addressId: addr, paymentMethod: "mock" });
  made.orders.push(order.json?.data?.orderId);
  check("buyer places an order", order.status === 201, JSON.stringify(order.json?.error ?? ""));
  check("buyer can't review before the order is delivered (403)", (await buyer.call("POST", "/api/store/reviews", review)).status === 403);

  const page1 = await (await fetch(`${BASE}/product/${slug}`, { headers: { Cookie: buyer.cookie } })).text();
  check("product page tells a not-yet-delivered buyer why they can't review yet", /once their order of this pickle has been delivered/.test(page1));

  for (const s of ["processing", "packed", "shipped", "out_for_delivery", "delivered"]) await admin.call("PATCH", `/api/orders/${order.json.data.orderId}`, { status: s });
  check("order marked delivered", (await one("SELECT status FROM orders WHERE id = ?", [order.json.data.orderId])).status === "DELIVERED");

  const page2 = await (await fetch(`${BASE}/product/${slug}`, { headers: { Cookie: buyer.cookie } })).text();
  check("product page now shows the review form to the delivered buyer", /Write a review/.test(page2));

  check("rating 0 is refused (422)", (await buyer.call("POST", "/api/store/reviews", { ...review, rating: 0 })).status === 422);
  check("rating 6 is refused (422)", (await buyer.call("POST", "/api/store/reviews", { ...review, rating: 6 })).status === 422);
  check("a one-word comment is refused (422)", (await buyer.call("POST", "/api/store/reviews", { ...review, comment: "ok" })).status === 422);

  const ok = await buyer.call("POST", "/api/store/reviews", { ...review, comment: "<script>alert(1)</script> lovely pickle, would buy again" });
  check("delivered buyer's review is accepted as pending (201)", ok.status === 201 && ok.json?.data?.status === "pending");
  check("a second review of the same product is refused (409)", (await buyer.call("POST", "/api/store/reviews", review)).status === 409);

  const pub1 = (await (await fetch(`${BASE}/api/store/products/${slug}`)).json()).data;
  check("pending review is NOT public, rating unchanged", pub1.reviews.length === 0 && pub1.reviewCount === 0);
  const page3 = await (await fetch(`${BASE}/product/${slug}`, { headers: { Cookie: buyer.cookie } })).text();
  check("buyer sees 'waiting for approval'", /It will appear here once it has been approved/.test(page3));

  const list = (await admin.call("GET", "/api/reviews")).json?.data ?? [];
  const mine = list.find((r) => r.productId === String(made.product));
  check("admin sees it as awaiting approval", mine?.status === "pending" && mine?.visible === false);

  const approve = await admin.call("PATCH", `/api/reviews/${mine.id}`, { visible: true });
  check("admin approves it", approve.status === 200);
  const pub2 = (await (await fetch(`${BASE}/api/store/products/${slug}`)).json()).data;
  check("approved review is public; product shows 4.0 from 1 review", pub2.reviews.length === 1 && Number(pub2.ratingAvg) === 4 && pub2.reviewCount === 1, `${pub2.ratingAvg}/${pub2.reviewCount}`);
  const page4 = await (await fetch(`${BASE}/product/${slug}`)).text();
  check("the review text is shown as plain text (no script injection)", page4.includes("&lt;script&gt;") && !page4.includes("<script>alert(1)</script>"));
  check("search engines see the rating (aggregateRating in the page data)", /"aggregateRating"/.test(page4));

  await admin.call("PATCH", `/api/reviews/${mine.id}`, { visible: false });
  const pub3 = (await (await fetch(`${BASE}/api/store/products/${slug}`)).json()).data;
  check("hiding it removes it and resets the rating", pub3.reviews.length === 0 && pub3.reviewCount === 0 && Number(pub3.ratingAvg) === 0);

  await admin.call("PATCH", `/api/reviews/${mine.id}`, { visible: true });
  check("deleting it keeps the rating correct", (await admin.call("DELETE", `/api/reviews/${mine.id}`)).status === 200 && (await one("SELECT review_count n FROM products WHERE id = ?", [made.product])).n === 0);
} catch (err) {
  failed++;
  console.log("FAIL  unexpected:", err.message);
} finally {
  if (made.product) await db.query("DELETE FROM reviews WHERE product_id = ?", [made.product]);
  for (const id of made.orders.filter(Boolean)) {
    for (const tbl of ["inventory_movements", "order_events", "payments", "order_items"]) await db.query(`DELETE FROM ${tbl} WHERE order_id = ?`, [id]);
    await db.query("DELETE FROM orders WHERE id = ?", [id]);
  }
  if (made.product) {
    await db.query("DELETE FROM inventory_movements WHERE inventory_id IN (SELECT i.id FROM inventory i JOIN product_variants v ON v.id = i.variant_id WHERE v.product_id = ?)", [made.product]);
    await db.query("DELETE FROM inventory WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)", [made.product]);
    await db.query("DELETE FROM product_variants WHERE product_id = ?", [made.product]);
    await db.query("DELETE FROM products WHERE id = ?", [made.product]);
  }
  for (const id of made.customers.filter(Boolean)) {
    for (const tbl of ["addresses", "customer_credentials", "password_resets", "carts"]) await db.query(`DELETE FROM ${tbl} WHERE customer_id = ?`, [id]).catch(() => undefined);
    await db.query("DELETE FROM customers WHERE id = ?", [id]);
  }
  await t.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
