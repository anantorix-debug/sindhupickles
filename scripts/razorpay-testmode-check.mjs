// Real Razorpay TEST-mode contract check (no card is charged). Against a running server configured with your
// Test keys in .env.local, it: places a checkout for a throwaway customer/product, starts the payment (which
// creates a real Razorpay Test order), then asks Razorpay's API for that order and compares it with ours.
// Keys are read from .env.local and never printed. The Razorpay Test order it creates is harmless (test mode).
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { createTestAdmin } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3001";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const KEY_ID = env.RAZORPAY_TEST_KEY_ID, KEY_SECRET = env.RAZORPAY_TEST_KEY_SECRET;

let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};
class Client {
  cookie = "";
  async call(method, path, body) {
    const res = await fetch(BASE + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() ?? []) this.cookie = c.split(";")[0];
    return { status: res.status, json: await res.json().catch(() => null) };
  }
}

const db = await mysql.createConnection({ host: "localhost", user: "root", database: "sindhu", timezone: "Z" });
await db.query("SET time_zone = '+00:00'");
const one = async (sql, p = []) => (await db.query(sql, p))[0][0];
const testAdmin = await createTestAdmin(db, BASE);
const admin = new Client(); admin.cookie = testAdmin.cookie;
const alice = new Client();
const stamp = Date.now();
const counterBefore = (await one("SELECT value FROM counters WHERE name='order_number'")).value;
const created = { product: null, customer: null, order: null };

try {
  check("Test keys present in .env.local", /^rzp_test_/.test(KEY_ID ?? "") && !!KEY_SECRET);
  const auth = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64") } });
  check("Razorpay accepts the Test keys", auth.status === 200, `HTTP ${auth.status}`);

  const prod = await admin.call("POST", "/api/products", { name: `ZZ Rzp Real ${stamp}`, sku: `ZZ-RR-${stamp}`, categoryId: 1, subcategoryId: null, price: 250, salePrice: null, status: "active", featured: false, spiceLevel: 2, shortDescription: "x", description: "Throwaway product for the real Razorpay Test-mode check." });
  created.product = prod.json.data.id;
  const variantId = prod.json.data.variants[0].id;
  await admin.call("PATCH", `/api/inventory/${variantId}`, { onHand: 5, reason: "razorpay test-mode check" });
  const reg = await alice.call("POST", "/api/store/auth/register", { name: "Zz Real", email: `zz.rr.${stamp}@example.com`, phone: "9876543210", password: "Passw0rdOne", confirmPassword: "Passw0rdOne" });
  created.customer = reg.json.data.id;
  const addr = (await alice.call("POST", "/api/store/addresses", { type: "Home", fullName: "Zz Real", phone: "9876543210", line1: "1 Test Street", line2: "", area: "Anna Nagar", city: "Salem", district: "Salem", state: "Tamil Nadu", pincode: "636030", landmark: "", isDefault: true })).json.data.id;

  const opts = (await alice.call("GET", "/api/store/checkout/options")).json.data.map((o) => o.id);
  check("'Pay online' (razorpay) is offered at checkout", opts.includes("razorpay"));

  const placed = await alice.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 2 }], addressId: addr, paymentMethod: "razorpay" });
  check("checkout creates a pending order", placed.status === 201 && placed.json.data.status === "PENDING_PAYMENT", JSON.stringify(placed.json?.data ?? placed.json?.error));
  created.order = placed.json.data.orderId;
  const row = await one("SELECT order_number, total_paise FROM orders WHERE id=?", [created.order]);

  const start = await alice.call("POST", "/api/store/payments/razorpay/order", { orderId: created.order });
  check("start payment returns a real Razorpay order id", start.status === 200 && /^order_/.test(start.json?.data?.razorpayOrderId ?? ""), start.json?.data?.razorpayOrderId);
  check("returns the TEST key id, mode=test, correct amount", start.json.data.keyId === KEY_ID && start.json.data.mode === "test" && start.json.data.amountPaise === row.total_paise);
  check("response never contains the key secret", !JSON.stringify(start.json).includes(KEY_SECRET));

  // Ask Razorpay itself what it stored.
  const rz = await (await fetch(`https://api.razorpay.com/v1/orders/${start.json.data.razorpayOrderId}`, { headers: { Authorization: "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64") } })).json();
  check("Razorpay holds that order in INR", rz.currency === "INR" && rz.status === "created");
  check("Razorpay's amount equals our server-computed total", rz.amount === row.total_paise, `${rz.amount} vs ${row.total_paise}`);
  check("Razorpay's receipt is our order number", rz.receipt === row.order_number, rz.receipt);

  const again = await alice.call("POST", "/api/store/payments/razorpay/order", { orderId: created.order });
  check("starting again re-uses the same Razorpay order", again.json.data.razorpayOrderId === start.json.data.razorpayOrderId);
  const bad = await alice.call("POST", "/api/store/payments/razorpay/verify", { orderId: created.order, razorpay_order_id: start.json.data.razorpayOrderId, razorpay_payment_id: "pay_FAKE000000001", razorpay_signature: "0".repeat(64) });
  check("a forged payment confirmation is rejected", bad.status === 400);
  const o = await one("SELECT status, payment_status FROM orders WHERE id=?", [created.order]);
  check("order is still unpaid after the forgery attempt", o.status === "PENDING_PAYMENT" && o.payment_status === "PENDING");

  const hook = await fetch(`${BASE}/api/store/payments/razorpay/webhook`, { method: "POST", headers: { "x-razorpay-signature": "bad", "content-type": "application/json" }, body: "{}" });
  check("webhook endpoint rejects an unsigned/forged call", hook.status === 401);
  console.log(`\nNote: Razorpay Test order ${start.json.data.razorpayOrderId} now exists in your Test dashboard (unpaid, harmless).`);
} finally {
  if (created.order) {
    await db.query("DELETE FROM inventory_movements WHERE order_id=?", [created.order]);
    await db.query("DELETE FROM order_events WHERE order_id=?", [created.order]);
    await db.query("DELETE FROM payments WHERE order_id=?", [created.order]);
    await db.query("DELETE FROM order_items WHERE order_id=?", [created.order]);
    await db.query("DELETE FROM orders WHERE id=?", [created.order]);
  }
  if (created.product) {
    await db.query("DELETE FROM inventory_movements WHERE inventory_id IN (SELECT i.id FROM inventory i JOIN product_variants v ON v.id=i.variant_id WHERE v.product_id=?)", [created.product]);
    await db.query("DELETE FROM inventory WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id=?)", [created.product]);
    await db.query("DELETE FROM product_variants WHERE product_id=?", [created.product]);
    await db.query("DELETE FROM products WHERE id=?", [created.product]);
  }
  if (created.customer) {
    await db.query("DELETE FROM addresses WHERE customer_id=?", [created.customer]);
    await db.query("DELETE FROM customers WHERE id=?", [created.customer]);
  }
  await db.query("UPDATE counters SET value=? WHERE name='order_number'", [counterBefore]);
  await testAdmin.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
