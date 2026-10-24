// End-to-end API check. Creates its own throwaway records and removes them at the end.
// It never touches existing products, orders, customers or stock.
import mysql from "mysql2/promise";
import { createTestAdmin } from "./_test-admin.mjs";

const B = process.env.BASE ?? "http://localhost:3111";
let adminCookie = "";
const call = async (method, path, body) => {
  const res = await fetch(B + "/api" + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), Cookie: adminCookie }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};
let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

const db = await mysql.createConnection({ host: "localhost", user: "root", database: "sindhu", timezone: "Z" });
const testAdmin = await createTestAdmin(db, B);
adminCookie = testAdmin.cookie;
const cleanup = { product: null, orders: [], cats: [], post: null };
const hadSettings = (await db.query("SELECT COUNT(*) n FROM store_settings"))[0][0].n > 0;

try {
  // ---- read endpoints
  for (const p of ["/categories", "/reviews", "/blog", "/enquiries", "/customers/1/addresses", "/products", "/orders", "/dashboard", "/reports", "/settings"]) {
    const r = await call("GET", p);
    check(`GET ${p}`, r.status === 200);
  }

  // ---- categories
  const root = await call("POST", "/categories", { name: "ZZ Test Root", slug: "", description: "", parentId: null, active: true });
  check("create root category", root.status === 201, root.json?.data?.slug);
  cleanup.cats.push(root.json?.data?.id);
  const sub = await call("POST", "/categories", { name: "ZZ Test Sub", slug: "", description: "", parentId: Number(root.json.data.id), active: true });
  check("create subcategory", sub.status === 201 && sub.json.data.parentId === root.json.data.id);
  cleanup.cats.push(sub.json?.data?.id);
  check("reject 3rd level", (await call("POST", "/categories", { name: "ZZ Deep", slug: "", description: "", parentId: Number(sub.json.data.id), active: true })).status === 422);
  check("refuse delete root with child", (await call("DELETE", `/categories/${root.json.data.id}`)).status === 409);

  // ---- product with dynamic category + images + upload
  const prod = await call("POST", "/products", {
    name: "ZZ Test Pickle", sku: "ZZ-TEST-1", categoryId: Number(root.json.data.id), subcategoryId: Number(sub.json.data.id),
    price: 100, salePrice: null, status: "draft", featured: false, spiceLevel: 2, shortDescription: "", description: "Throwaway product for API tests.",
  });
  check("create product in new category", prod.status === 201 && prod.json.data.category === "ZZ Test Root" && prod.json.data.subcategory === "ZZ Test Sub");
  cleanup.product = prod.json?.data?.id;
  const variantId = prod.json?.data?.variants?.[0]?.id;
  check("product rejects wrong subcategory", (await call("PUT", `/products/${cleanup.product}`, { ...{ name: "ZZ Test Pickle", sku: "ZZ-TEST-1", price: 100, salePrice: null, status: "draft", featured: false, spiceLevel: 2, shortDescription: "", description: "Throwaway product for API tests." }, categoryId: 1, subcategoryId: Number(sub.json.data.id) })).status === 422);

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const up = async (bytes, name, type) => {
    const fd = new FormData();
    fd.set("file", new File([bytes], name, { type }));
    fd.set("folder", "products");
    const r = await fetch(B + "/api/upload", { method: "POST", body: fd, headers: { Cookie: adminCookie } });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const ok1 = await up(png, "a.png", "image/png");
  check("upload valid PNG", ok1.status === 201 && ok1.json.data.url.startsWith("/uploads/products/"));
  check("upload > 3MB rejected (413)", (await up(Buffer.concat([png, Buffer.alloc(3 * 1024 * 1024)]), "big.png", "image/png")).status === 413);
  check("upload disguised text rejected (415)", (await up(Buffer.from("not an image at all"), "evil.png", "image/png")).status === 415);
  const served = await fetch(B + ok1.json.data.url);
  check("serve uploaded file", served.status === 200 && served.headers.get("content-type") === "image/png");
  check("path traversal blocked", (await fetch(B + "/uploads/products/..%2F..%2Fpackage.json")).status === 404);

  const img1 = await call("POST", `/products/${cleanup.product}/images`, { url: ok1.json.data.url, alt: "" });
  check("attach image", img1.status === 201 && img1.json.data.images.length === 1);
  const ok2 = await up(png, "b.png", "image/png");
  const img2 = await call("POST", `/products/${cleanup.product}/images`, { url: ok2.json.data.url, alt: "second" });
  const second = img2.json.data.images[1];
  const made = await call("PATCH", `/products/${cleanup.product}/images/${second.id}`);
  check("make image main", made.json.data.images[0].id === second.id);
  check("remove image", (await call("DELETE", `/products/${cleanup.product}/images/${second.id}`)).json.data.images.length === 1);
  check("reject non-https/non-upload image url", (await call("POST", `/products/${cleanup.product}/images`, { url: "http://x.com/a.png", alt: "" })).status === 422);

  // ---- order flow rules on real orders: invalid moves only (no writes happen)
  const [[delivered]] = [await db.query("SELECT id FROM orders WHERE status='DELIVERED' LIMIT 1").then(([r]) => r)];
  check("delivered -> processing refused", (await call("PATCH", `/orders/${delivered.id}`, { status: "processing" })).status === 409);
  const [cancelled] = await db.query("SELECT id FROM orders WHERE status='CANCELLED' LIMIT 1");
  if (cancelled[0]) check("cancelled order is locked", (await call("PATCH", `/orders/${cancelled[0].id}`, { status: "confirmed" })).status === 409);

  // ---- stock effects on SYNTHETIC orders that use only my test variant
  await db.query("UPDATE inventory SET on_hand = 10, reserved = 3 WHERE variant_id = ?", [variantId]);
  const mkOrder = async (n, status, qty) => {
    const [r] = await db.query(
      `INSERT INTO orders (order_number, customer_id, status, payment_status, payment_method, subtotal_paise, discount_paise, shipping_paise, total_paise,
         ship_full_name, ship_phone, ship_email, ship_line1, ship_city, ship_state, ship_pincode, ship_country, placed_at, created_at, updated_at)
       VALUES (?, 1, ?, 'CAPTURED', 'MOCK', 10000, 0, 0, 10000, 'ZZ', '0', 'zz@example.com', 'x', 'x', 'x', '000000', 'India', NOW(3), NOW(3), NOW(3))`,
      [n, status],
    );
    await db.query(
      `INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_label, sku, unit_price_paise, list_price_paise, quantity, line_total_paise)
       VALUES (?, ?, ?, 'ZZ Test Pickle', '250g', 'ZZ-TEST-1-250', 10000, 10000, ?, ?)`,
      [r.insertId, cleanup.product, variantId, qty, qty * 10000],
    );
    cleanup.orders.push(r.insertId);
    return r.insertId;
  };
  const stock = async () => (await db.query("SELECT on_hand, reserved FROM inventory WHERE variant_id = ?", [variantId]))[0][0];

  const o1 = await mkOrder("ZZ-T1", "PROCESSING", 2);
  check("processing -> shipped allowed", (await call("PATCH", `/orders/${o1}`, { status: "packed" })).status === 200);
  check("packed -> shipped allowed", (await call("PATCH", `/orders/${o1}`, { status: "shipped" })).status === 200);
  const s1 = await stock();
  check("ship consumes stock (on_hand 10->8, reserved 3->1)", s1.on_hand === 8 && s1.reserved === 1, JSON.stringify(s1));
  check("shipped -> cancelled allowed but no restock", (await call("PATCH", `/orders/${o1}`, { status: "cancelled" })).status === 200 && (await stock()).on_hand === 8);
  check("cancelled order locked", (await call("PATCH", `/orders/${o1}`, { status: "delivered" })).status === 409);
  check("cannot move backwards", (await call("PATCH", `/orders/${await mkOrder("ZZ-T2", "PACKED", 1)}`, { status: "processing" })).status === 409);

  const o3 = await mkOrder("ZZ-T3", "CONFIRMED", 1);
  await db.query("UPDATE inventory SET on_hand = 8, reserved = 1 WHERE variant_id = ?", [variantId]);
  check("cancel before shipping allowed", (await call("PATCH", `/orders/${o3}`, { status: "cancelled" })).status === 200);
  const s3 = await stock();
  check("cancel releases reservation (reserved 1->0)", s3.reserved === 0 && s3.on_hand === 8, JSON.stringify(s3));

  const trk = await call("PATCH", `/orders/${o3}/tracking`, { carrier: "Delhivery", number: "DL123456" });
  check("tracking refused on cancelled order", trk.status === 409);
  const o4 = await mkOrder("ZZ-T4", "SHIPPED", 1);
  const t4 = await call("PATCH", `/orders/${o4}/tracking`, { carrier: "Delhivery", number: "DL123456" });
  check("set tracking", t4.status === 200 && t4.json.data.tracking?.number === "DL123456");
  check("tracking validation", (await call("PATCH", `/orders/${o4}/tracking`, { carrier: "", number: "" })).status === 422);

  // ---- delete guard: product now has stock history -> must refuse
  check("delete guard refuses product with history (409)", (await call("DELETE", `/products/${cleanup.product}`)).status === 409);
  check("product still exists after refused delete", (await call("GET", `/products/${cleanup.product}`)).status === 200);

  // ---- blog + settings
  const post = await call("POST", "/blog", { title: "ZZ Test Post", slug: "", category: "Test", authorName: "", excerpt: "", content: "word ".repeat(450), featuredImage: "", tags: "a, b", status: "draft", metaTitle: "", metaDescription: "", focusKeyword: "" });
  check("create blog draft", post.status === 201 && post.json.data.readTime === 3 && post.json.data.tags.length === 2 && post.json.data.publishedAt === null);
  cleanup.post = post.json?.data?.id;
  const pub = await call("PUT", `/blog/${cleanup.post}`, { title: "ZZ Test Post", slug: "", category: "Test", authorName: "", excerpt: "", content: "word ".repeat(450), featuredImage: "", tags: ["a"], status: "published", metaTitle: "", metaDescription: "", focusKeyword: "" });
  check("publish stamps publishedAt", pub.status === 200 && !!pub.json.data.publishedAt);
  const cur = (await call("GET", "/settings")).json.data;
  const saved = await call("PUT", "/settings", { ...cur, tagline: cur.tagline });
  check("settings persisted in DB", saved.status === 200 && (await db.query("SELECT COUNT(*) n FROM store_settings"))[0][0].n === 1);
} finally {
  // ---- cleanup: only rows created by this script
  for (const id of cleanup.orders) {
    await db.query("DELETE FROM order_events WHERE order_id = ?", [id]);
    await db.query("DELETE FROM order_items WHERE order_id = ?", [id]);
    await db.query("DELETE FROM orders WHERE id = ?", [id]);
  }
  if (cleanup.product) {
    await db.query("DELETE FROM inventory_movements WHERE inventory_id IN (SELECT i.id FROM inventory i JOIN product_variants v ON v.id = i.variant_id WHERE v.product_id = ?)", [cleanup.product]);
    await db.query("DELETE FROM inventory WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)", [cleanup.product]);
    await db.query("DELETE FROM product_images WHERE product_id = ?", [cleanup.product]);
    await db.query("DELETE FROM product_variants WHERE product_id = ?", [cleanup.product]);
    await db.query("DELETE FROM products WHERE id = ?", [cleanup.product]);
  }
  for (const id of cleanup.cats.filter(Boolean).reverse()) await db.query("DELETE FROM categories WHERE id = ?", [id]);
  if (cleanup.post) await db.query("DELETE FROM blog_posts WHERE id = ?", [cleanup.post]);
  if (!hadSettings) await db.query("DELETE FROM store_settings WHERE setting_key = 'general'");
  await testAdmin.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
