// Invoices: issued with every placed order, shown/downloaded in Admin -> Orders, and by the customer for their own orders.
// Uses throwaway products, customers and orders and removes them afterwards; the shop settings row and the order/invoice
// counters are put back. Online (Razorpay) paid/failed cases are covered in razorpay-smoke.mjs.
//   BASE=http://localhost:3113 node scripts/invoice-smoke.mjs
import { writeFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { createTestAdmin } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3113";
let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

class Client {
  cookie = "";
  async raw(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { Origin: BASE, ...(body ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    for (const c of res.headers.getSetCookie?.() ?? []) this.cookie = c.split(";")[0];
    return res;
  }
  async call(method, path, body) {
    const res = await this.raw(method, path, body);
    return { status: res.status, json: await res.json().catch(() => null) };
  }
  async pdf(path) {
    const res = await this.raw("GET", path);
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, type: res.headers.get("content-type") ?? "", disposition: res.headers.get("content-disposition") ?? "", buf, text: buf.toString("latin1") };
  }
}
const pages = (pdf) => (pdf.text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
// SAVE_PDF_DIR=<folder> keeps the generated PDFs for a visual check.
const savePdf = (name, pdf) => process.env.SAVE_PDF_DIR && writeFileSync(`${process.env.SAVE_PDF_DIR}/${name}.pdf`, pdf.buf);

const db = await mysql.createConnection({ host: "localhost", user: "root", database: process.env.DB_NAME ?? "sindhu", timezone: "Z" });
const one = async (sql, p = []) => (await db.query(sql, p))[0][0];
const testAdmin = await createTestAdmin(db, BASE);
const admin = new Client();
admin.cookie = testAdmin.cookie;
const alice = new Client();
const mallory = new Client();
const stamp = Date.now();
const created = { products: [], orders: [], customers: [] };
const orderCounterBefore = (await one("SELECT value FROM counters WHERE name='order_number'"))?.value ?? null;
const invoiceCounterBefore = (await one("SELECT value FROM counters WHERE name='invoice_number'"))?.value ?? null;
const settingsBefore = await one("SELECT setting_value FROM store_settings WHERE setting_key='general'");
const couponBefore = (await one("SELECT used_count FROM coupons WHERE code='SINDHU05'"))?.used_count ?? null;
const GSTIN = "33ABCDE1234F1Z5";

try {
  // ---------- setup: settings, two products, two customers, an address ----------
  const settings = (await admin.call("GET", "/api/settings")).json.data;
  const saved = await admin.call("PUT", "/api/settings", { ...settings, codEnabled: true, gstin: GSTIN.toLowerCase() });
  check("owner can save a GSTIN (stored upper-case)", saved.status === 200 && saved.json.data.gstin === GSTIN);
  check("an invalid GSTIN is refused (422)", (await admin.call("PUT", "/api/settings", { ...settings, codEnabled: true, gstin: "12345" })).status === 422);

  const variants = [];
  for (const [i, price] of [[1, 150], [2, 90]]) {
    const p = await admin.call("POST", "/api/products", {
      name: `ZZ Invoice Pickle ${i} ${stamp}`, sku: `ZZ-INV-${i}-${stamp}`, categoryId: 1, subcategoryId: null, price, salePrice: null, status: "active",
      featured: false, spiceLevel: 2, shortDescription: "Throwaway", description: "Throwaway product for the invoice test.",
    });
    created.products.push(p.json.data.id);
    variants.push(p.json.data.variants[0].id);
    await admin.call("PATCH", `/api/inventory/${p.json.data.variants[0].id}`, { onHand: 20, reason: "invoice test" });
  }
  check("two throwaway products created", created.products.length === 2);

  const regA = await alice.call("POST", "/api/store/auth/register", { name: "Zz Invoice Alice", email: `zz.inv.alice.${stamp}@example.com`, phone: "9876543210", password: "Passw0rdOne", confirmPassword: "Passw0rdOne" });
  created.customers.push(regA.json.data.id);
  const regM = await mallory.call("POST", "/api/store/auth/register", { name: "Zz Invoice Mallory", email: `zz.inv.mal.${stamp}@example.com`, phone: "9876543211", password: "Passw0rdTwo", confirmPassword: "Passw0rdTwo" });
  created.customers.push(regM.json.data.id);
  const addr = {
    type: "Home", fullName: "Zz Invoice Alice", phone: "9876543210", line1: "4/543 Mariamman Kovil Street", line2: "", area: "Chinnakuppam", city: "Villupuram",
    district: "Villupuram", state: "Tamil Nadu", pincode: "605105", landmark: "Near the temple", isDefault: true,
  };
  const address = await alice.call("POST", "/api/store/addresses", addr);
  const addressId = address.json.data.id;

  // ---------- 1. a placed (COD) order issues its invoice at once ----------
  const o1 = await alice.call("POST", "/api/store/checkout", {
    items: [{ variantId: variants[0], quantity: 2 }, { variantId: variants[1], quantity: 1 }],
    addressId, paymentMethod: "cod", couponCode: "SINDHU05",
  });
  check("COD order placed", o1.status === 201, `status ${o1.status}`);
  const id1 = o1.json.data.orderId;
  created.orders.push(id1);
  const order1 = await one("SELECT * FROM orders WHERE id=?", [id1]);
  const row1 = await one("SELECT * FROM invoices WHERE order_id=?", [id1]);
  // Put the real GSTIN back straight away: opening Admin -> Orders below issues invoices for real older orders, and
  // those must carry the shop's real details, never this test's.
  await admin.call("PUT", "/api/settings", { ...settings, codEnabled: true });
  check("1. invoice issued together with the order", Boolean(row1) && /^INV-\d{5}$/.test(row1.invoice_number), row1?.invoice_number);
  check("   issue recorded on the order timeline", (await one("SELECT COUNT(*) n FROM order_events WHERE order_id=? AND type='INVOICE'", [id1])).n === 1);

  // ---------- 2. it belongs to the right order ----------
  const api1 = (await admin.call("GET", `/api/orders/${id1}/invoice`)).json?.data;
  check("2. invoice API returns the invoice of this order", api1?.orderId === String(id1) && api1?.orderNumber === order1.order_number && api1?.invoiceNumber === row1.invoice_number);
  const listRow = (await admin.call("GET", "/api/orders")).json.data.find((o) => o.id === String(id1));
  check("   Orders list shows the invoice number on that order", listRow?.invoiceNumber === row1.invoice_number);
  check("   invoice by id returns the same invoice", (await admin.call("GET", `/api/invoices/${row1.id}`)).json?.data?.invoiceNumber === row1.invoice_number);

  // ---------- 3. admin preview ----------
  const preview = await admin.raw("GET", `/admin/orders/${id1}/invoice`);
  const html = await preview.text();
  check("3. admin invoice preview page opens", preview.status === 200 && html.includes(row1.invoice_number) && html.includes(order1.order_number) && html.includes("Download PDF"));
  check("   admin orders page offers View invoice + Download", (await (await admin.raw("GET", "/admin/orders")).text()).includes(row1.invoice_number));

  // ---------- 4. PDF download ----------
  const pdf1 = await admin.pdf(`/api/orders/${id1}/invoice/download`);
  savePdf("cod-order", pdf1);
  check("4. PDF downloads (application/pdf, attachment)", pdf1.status === 200 && pdf1.type === "application/pdf" && pdf1.disposition.startsWith("attachment") && pdf1.buf.subarray(0, 5).toString() === "%PDF-");
  check("   meaningful filename Invoice_<order>.pdf", pdf1.disposition.includes(`filename="Invoice_${order1.order_number}.pdf"`), pdf1.disposition);
  check("   A4 portrait, one page", /\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/.test(pdf1.text) && pages(pdf1) === 1, `pages ${pages(pdf1)}`);
  check("   ₹ font embedded (Noto Sans)", /NotoSans/.test(pdf1.text));
  check("   ?inline=1 opens in the browser instead", (await admin.pdf(`/api/orders/${id1}/invoice/download?inline=1`)).disposition.startsWith("inline"));

  // ---------- 5. repeat = same invoice ----------
  const again = await admin.call("POST", `/api/orders/${id1}/invoice`);
  await admin.pdf(`/api/orders/${id1}/invoice/download`);
  check("5. repeated generate/download returns the same invoice (200, not 201)", again.status === 200 && again.json.data.invoiceNumber === row1.invoice_number);
  check("   still exactly one invoice for the order", (await one("SELECT COUNT(*) n FROM invoices WHERE order_id=?", [id1])).n === 1);

  // ---------- 6. 7. 8. items, totals, address ----------
  check("6. both products on the invoice with quantities and line totals", api1.items.length === 2 && api1.items[0].quantity === 2 && api1.items[0].unitPrice === 150 && api1.items[0].total === 300 && api1.items[1].total === 90);
  check("7. totals match the order: subtotal − discount + shipping = total",
    api1.subtotal === order1.subtotal_paise / 100 && api1.discount === order1.discount_paise / 100 && api1.discount > 0 && api1.couponCode === "SINDHU05" &&
    api1.shipping === order1.shipping_paise / 100 && Math.abs(api1.subtotal - api1.discount + api1.shipping - api1.total) < 0.001 && api1.total === order1.total_paise / 100,
    JSON.stringify({ s: api1.subtotal, d: api1.discount, sh: api1.shipping, t: api1.total }));
  check("   COD: nothing paid yet, full balance due", api1.amountPaid === 0 && api1.balanceDue === api1.total && api1.paymentStatus === "pending");
  check("   no tax line invented (orders carry no tax)", api1.tax === 0);
  const lines = api1.billTo.addressLines.join(" | ");
  check("8. customer address on the invoice", lines.includes("4/543 Mariamman Kovil Street") && lines.includes("Villupuram 605105") && lines.includes("Tamil Nadu") && lines.includes("Near the temple") && api1.billTo.name === "Zz Invoice Alice" && api1.billTo.phone === "9876543210");
  check("   business details from Settings incl. GSTIN", api1.business.gstin === GSTIN && api1.business.name === settings.storeName && api1.business.phone === settings.supportPhone);

  // ---------- 10. who may see it ----------
  const visitor = new Client();
  check("10. signed-out visitor: admin invoice API 401", (await visitor.call("GET", `/api/orders/${id1}/invoice`)).status === 401 && (await visitor.call("GET", `/api/orders/${id1}/invoice/download`)).status === 401);
  check("    a customer can't use the admin invoice API (401)", (await alice.call("GET", `/api/orders/${id1}/invoice/download`)).status === 401);
  check("    signed-out visitor: customer invoice 401", (await visitor.call("GET", `/api/store/orders/${id1}/invoice`)).status === 401);
  check("    another customer gets 404 for someone else's invoice", (await mallory.call("GET", `/api/store/orders/${id1}/invoice`)).status === 404);
  const own = await alice.pdf(`/api/store/orders/${id1}/invoice`);
  check("    the customer downloads their own invoice PDF", own.status === 200 && own.type === "application/pdf" && own.buf.subarray(0, 5).toString() === "%PDF-");
  check("    customer order page shows the Download invoice button", (await (await alice.raw("GET", `/account/orders/${id1}?placed=1`)).text()).includes("Download invoice"));
  check("    unknown order -> 404", (await admin.call("GET", "/api/orders/999999999/invoice")).status === 404);

  // ---------- 11. later edits don't change an issued invoice ----------
  await admin.call("PUT", `/api/products/${created.products[0]}`, { name: `ZZ Renamed ${stamp}`, sku: `ZZ-INV-1-${stamp}`, categoryId: 1, subcategoryId: null, price: 999, salePrice: null, status: "active", featured: false, spiceLevel: 2, shortDescription: "x", description: "Renamed throwaway product." });
  await alice.call("PUT", `/api/store/addresses/${addressId}`, { ...addr, line1: "1 Completely New Road", city: "Chennai", pincode: "600001" });
  await alice.call("PATCH", "/api/store/account", { name: "Zz Alice Renamed", phone: "9000000000" });
  const after = (await admin.call("GET", `/api/orders/${id1}/invoice`)).json.data;
  check("11. product rename/price change doesn't touch the invoice", after.items[0].name === `ZZ Invoice Pickle 1 ${stamp}` && after.items[0].unitPrice === 150 && after.total === api1.total);
  check("    customer's new address/name don't touch it", after.billTo.addressLines.join(" | ") === lines && after.billTo.name === "Zz Invoice Alice");
  check("    changing the GSTIN in Settings doesn't touch it", after.business.gstin === GSTIN && after.invoiceNumber === row1.invoice_number);

  // ---------- numbering: unique + sequential; new invoices use the current settings ----------
  const o2 = await alice.call("POST", "/api/store/checkout", { items: [{ variantId: variants[1], quantity: 1 }], addressId, paymentMethod: "mock" });
  created.orders.push(o2.json.data.orderId);
  const inv2 = (await admin.call("GET", `/api/orders/${o2.json.data.orderId}/invoice`)).json.data;
  const n = (s) => Number(s.split("-").pop());
  // Other orders may get invoices in between (opening Admin -> Orders issues them for older orders), so check that the
  // numbers in between all exist exactly once: increasing, no gaps, no duplicates.
  const between = (await one(
    "SELECT COUNT(*) n, COUNT(DISTINCT invoice_number) d FROM invoices WHERE CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED) BETWEEN ? AND ?",
    [n(row1.invoice_number), n(inv2.invoiceNumber)],
  ));
  check("later order gets a later number; no gaps, no duplicates", n(inv2.invoiceNumber) > n(row1.invoice_number) && between.n === n(inv2.invoiceNumber) - n(row1.invoice_number) + 1 && between.d === between.n, `${row1.invoice_number} -> ${inv2.invoiceNumber}`);
  check("paid order: amount paid = total, nothing due", inv2.paymentStatus === "captured" && inv2.amountPaid === inv2.total && inv2.balanceDue === 0);
  check("new invoice uses the new address and the current Settings", inv2.billTo.addressLines.includes("1 Completely New Road") && inv2.business.gstin === (settings.gstin ?? ""));

  // ---------- cancelled: same invoice, nothing due ----------
  const cancel = await admin.call("PATCH", `/api/orders/${id1}`, { status: "cancelled" });
  const cancelled = (await admin.call("GET", `/api/orders/${id1}/invoice`)).json.data;
  check("cancelling keeps the same invoice, marked cancelled, nothing due", cancel.status === 200 && cancelled.invoiceNumber === row1.invoice_number && cancelled.orderStatus === "cancelled" && cancelled.balanceDue === 0);

  // ---------- older orders (no invoice yet) + concurrency + 12. long invoice ----------
  // An order as if placed before invoices existed: 45 lines and a very long address, written straight to the database.
  const [ins] = await db.query(
    `INSERT INTO orders (order_number, customer_id, status, payment_status, payment_method, subtotal_paise, discount_paise, shipping_paise, total_paise,
       ship_full_name, ship_phone, ship_email, ship_line1, ship_line2, ship_landmark, ship_city, ship_state, ship_pincode, ship_country, placed_at, created_at, updated_at)
     VALUES (?, ?, 'DELIVERED', 'CAPTURED', 'RAZORPAY', 450000, 0, 0, 450000, 'Zz Long Address Customer With A Very Long Name', '9876543210', ?, ?, ?, ?, 'Villupuram', 'Tamil Nadu', '605105', 'India', NOW(3), NOW(3), NOW(3))`,
    [`ZZINV-${stamp}`, created.customers[0], `zz.inv.alice.${stamp}@example.com`,
      "Door No. 4/543, Second Floor, Sri Lakshmi Narasimha Apartments, Mariamman Kovil Street, Behind the Government Higher Secondary School",
      "Chinnakuppam Siruvanthadu Village, Vikravandi Taluk", "Opposite the big banyan tree near the bus stop, next to the ration shop"],
  );
  const id3 = ins.insertId;
  created.orders.push(id3);
  for (let i = 1; i <= 45; i++) {
    await db.query(
      "INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_label, sku, unit_price_paise, list_price_paise, quantity, line_total_paise) VALUES (?, NULL, NULL, ?, '250g', ?, 10000, 10000, 1, 10000)",
      [id3, `ZZ Long Invoice Line ${i} – Traditional Homemade Pickle With A Fairly Long Product Name`, `ZZ-L-${i}`],
    );
  }
  check("older order starts without an invoice", (await one("SELECT COUNT(*) n FROM invoices WHERE order_id=?", [id3])).n === 0);
  const burst = await Promise.all(Array.from({ length: 6 }, () => admin.call("POST", `/api/orders/${id3}/invoice`)));
  const numbers = new Set(burst.map((r) => r.json?.data?.invoiceNumber));
  check("6 simultaneous requests: one invoice, one number, one 201", (await one("SELECT COUNT(*) n FROM invoices WHERE order_id=?", [id3])).n === 1 && numbers.size === 1 && burst.filter((r) => r.status === 201).length === 1 && burst.every((r) => r.status === 200 || r.status === 201), `statuses ${burst.map((r) => r.status).join(",")}`);
  const long = await admin.pdf(`/api/orders/${id3}/invoice/download`);
  savePdf("long-order", long);
  const cancelledPdf = await admin.pdf(`/api/orders/${id1}/invoice/download`);
  savePdf("cancelled-order", cancelledPdf);
  check("12. long invoice (45 lines) spans several A4 pages", long.status === 200 && pages(long) >= 2, `pages ${pages(long)}`);
  const inv3 = (await admin.call("GET", `/api/orders/${id3}/invoice`)).json.data;
  check("    all 45 lines and the full long address kept", inv3.items.length === 45 && inv3.billTo.addressLines.some((l) => l.includes("Behind the Government Higher Secondary School")) && inv3.total === 4500);

  // Admin Orders page gives any remaining older order its invoice.
  const [ins4] = await db.query(
    `INSERT INTO orders (order_number, customer_id, status, payment_status, payment_method, subtotal_paise, discount_paise, shipping_paise, total_paise,
       ship_full_name, ship_phone, ship_email, ship_line1, ship_city, ship_state, ship_pincode, placed_at, created_at, updated_at)
     VALUES (?, ?, 'SHIPPED', 'PENDING', 'COD', 12000, 0, 6000, 18000, 'Zz Old', '9876543210', 'zz@example.com', '1 Old Street', 'Salem', 'Tamil Nadu', '636030', NOW(3) - INTERVAL 30 DAY, NOW(3), NOW(3))`,
    [`ZZOLD-${stamp}`, created.customers[0]],
  );
  created.orders.push(ins4.insertId);
  await db.query("INSERT INTO order_items (order_id, product_name, variant_label, sku, unit_price_paise, list_price_paise, quantity, line_total_paise) VALUES (?, 'ZZ Old Item', '100g', 'ZZ-OLD', 12000, 12000, 1, 12000)", [ins4.insertId]);
  await (await admin.raw("GET", "/admin/orders")).text(); // the page streams; read it all so its render has finished
  check("opening Admin -> Orders issues invoices for older orders", (await one("SELECT COUNT(*) n FROM invoices WHERE order_id=?", [ins4.insertId])).n === 1);
} finally {
  for (const id of created.orders.filter(Boolean)) {
    await db.query("DELETE FROM inventory_movements WHERE order_id = ?", [id]);
    await db.query("DELETE FROM order_events WHERE order_id = ?", [id]);
    await db.query("DELETE FROM payments WHERE order_id = ?", [id]);
    await db.query("DELETE FROM order_items WHERE order_id = ?", [id]);
    await db.query("DELETE FROM orders WHERE id = ?", [id]); // its invoice goes with it
  }
  for (const pid of created.products) {
    await db.query("DELETE FROM inventory_movements WHERE inventory_id IN (SELECT i.id FROM inventory i JOIN product_variants v ON v.id = i.variant_id WHERE v.product_id = ?)", [pid]);
    await db.query("DELETE FROM inventory WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)", [pid]);
    await db.query("DELETE FROM product_variants WHERE product_id = ?", [pid]);
    await db.query("DELETE FROM products WHERE id = ?", [pid]);
  }
  for (const cid of created.customers.filter(Boolean)) {
    await db.query("DELETE FROM addresses WHERE customer_id = ?", [cid]);
    await db.query("DELETE FROM customers WHERE id = ?", [cid]);
  }
  if (settingsBefore) await db.query("UPDATE store_settings SET setting_value=? WHERE setting_key='general'", [typeof settingsBefore.setting_value === "string" ? settingsBefore.setting_value : JSON.stringify(settingsBefore.setting_value)]);
  else await db.query("DELETE FROM store_settings WHERE setting_key='general'");
  if (orderCounterBefore !== null) await db.query("UPDATE counters SET value = ? WHERE name='order_number'", [orderCounterBefore]);
  await db.query(
    "INSERT INTO counters (name, value) SELECT 'invoice_number', GREATEST(?, COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)), 0)) FROM invoices ON DUPLICATE KEY UPDATE value = VALUES(value)",
    [invoiceCounterBefore ?? 0],
  );
  if (couponBefore !== null) await db.query("UPDATE coupons SET used_count = ? WHERE code='SINDHU05'", [couponBefore]);
  const left = await one("SELECT (SELECT COUNT(*) FROM customers WHERE email LIKE 'zz.inv.%') c, (SELECT COUNT(*) FROM invoices i JOIN orders o ON o.id = i.order_id WHERE o.order_number LIKE 'ZZ%') i");
  console.log(`cleanup: leftover test customers=${left.c} test invoices=${left.i}`);
  await testAdmin.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
