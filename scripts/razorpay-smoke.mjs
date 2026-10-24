// Razorpay flow test against a LOCAL MOCK of Razorpay's API — no real keys, no real money.
//
// The Next server under test must be started with:
//   RAZORPAY_MODE=test RAZORPAY_TEST_KEY_ID=rzp_test_mockkey RAZORPAY_TEST_KEY_SECRET=mock_key_secret_for_tests
//   RAZORPAY_TEST_WEBHOOK_SECRET=mock_webhook_secret_for_tests RAZORPAY_API_BASE=http://localhost:4010/v1
//   CRON_SECRET=mock_cron_secret_for_tests_1234567890
// (see `npm run test:razorpay`-style instructions in docs/RAZORPAY_INTEGRATION.md).
// Uses throwaway product/customers/orders and removes them afterwards.
import http from "node:http";
import { createHmac } from "node:crypto";
import mysql from "mysql2/promise";
import { createTestAdmin } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3112";
const KEY_SECRET = "mock_key_secret_for_tests";
const WEBHOOK_SECRET = "mock_webhook_secret_for_tests";
const CRON_SECRET = "mock_cron_secret_for_tests_1234567890";

let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

// ---------- mock Razorpay ----------
const orders = new Map();
const payments = new Map();
let seq = 0;
const mock = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (code, obj) => (res.writeHead(code, { "Content-Type": "application/json" }), res.end(JSON.stringify(obj)));
    const url = req.url.replace(/^\/v1/, "");
    if (!req.headers.authorization?.startsWith("Basic ")) return send(401, { error: { description: "no auth" } });
    if (req.method === "POST" && url === "/orders") {
      const b = JSON.parse(body);
      const o = { id: `order_MOCK${++seq}`, amount: b.amount, currency: b.currency, receipt: b.receipt, status: "created" };
      orders.set(o.id, o);
      return send(200, o);
    }
    if (req.method === "POST" && url === "/__set") {
      const p = JSON.parse(body);
      payments.set(p.id, p);
      return send(200, {});
    }
    let m = url.match(/^\/payments\/([^/]+)$/);
    if (req.method === "GET" && m) return payments.has(m[1]) ? send(200, payments.get(m[1])) : send(404, { error: { description: "not found" } });
    m = url.match(/^\/payments\/([^/]+)\/capture$/);
    if (req.method === "POST" && m && payments.has(m[1])) {
      payments.get(m[1]).status = "captured";
      return send(200, payments.get(m[1]));
    }
    send(404, { error: { description: "unknown" } });
  });
});
await new Promise((r) => mock.listen(4010, r));
const setPayment = (p) => payments.set(p.id, { currency: "INR", method: "upi", status: "captured", ...p });

// ---------- tiny browser ----------
class Client {
  cookie = "";
  async call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) this.cookie = c.split(";")[0];
    return { status: res.status, json: await res.json().catch(() => null) };
  }
}
const admin = new Client(), alice = new Client(), mallory = new Client();
const db = await mysql.createConnection({ host: "localhost", user: "root", database: "sindhu", timezone: "Z" });
await db.query("SET time_zone = '+00:00'"); // same clock as the app (the MySQL server itself runs in IST)
const one = async (sql, p = []) => (await db.query(sql, p))[0][0];
const testAdmin = await createTestAdmin(db, BASE);
admin.cookie = testAdmin.cookie;

const stamp = Date.now();
const counterBefore = (await one("SELECT value FROM counters WHERE name='order_number'")).value;
const created = { product: null, customers: [], orders: [], events: [] };
const sign = (orderId, paymentId) => createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
const webhook = async (event, payload, { eventId = `zz-evt-${stamp}-${++seq}`, secret = WEBHOOK_SECRET, tamper = false } = {}) => {
  const raw = JSON.stringify({ event, payload });
  created.events.push(eventId);
  const res = await fetch(`${BASE}/api/store/payments/razorpay/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": createHmac("sha256", secret).update(raw).digest("hex"), "x-razorpay-event-id": eventId },
    body: tamper ? raw.replace('"amount":', '"amount": ') : raw,
  });
  return { status: res.status, json: await res.json().catch(() => null), eventId, raw };
};
const entity = (p) => ({ payment: { entity: p } });

try {
  // ---------- setup: throwaway product + customers ----------
  const prod = await admin.call("POST", "/api/products", { name: `ZZ Rzp ${stamp}`, sku: `ZZ-RZP-${stamp}`, categoryId: 1, subcategoryId: null, price: 500, salePrice: null, status: "active", featured: false, spiceLevel: 2, shortDescription: "x", description: "Throwaway product for the Razorpay test." });
  created.product = prod.json.data.id;
  const variantId = prod.json.data.variants[0].id;
  await admin.call("PATCH", `/api/inventory/${variantId}`, { onHand: 20, reason: "razorpay test" });
  const reg = async (c, tag) => {
    const r = await c.call("POST", "/api/store/auth/register", { name: `Zz ${tag}`, email: `zz.rzp.${tag}.${stamp}@example.com`, phone: "9876543210", password: "Passw0rdOne", confirmPassword: "Passw0rdOne" });
    created.customers.push(r.json.data.id);
  };
  await reg(alice, "alice");
  await reg(mallory, "mallory");
  const addr = (await alice.call("POST", "/api/store/addresses", { type: "Home", fullName: "Zz Alice", phone: "9876543210", line1: "1 Test Street", line2: "", area: "Anna Nagar", city: "Chennai", district: "Chennai", state: "Tamil Nadu", pincode: "600040", landmark: "", isDefault: true })).json.data.id;

  const place = async (qty = 1) => {
    const r = await alice.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: qty }], addressId: addr, paymentMethod: "razorpay" });
    if (r.status === 201) created.orders.push(r.json.data.orderId);
    return r;
  };
  const orderRow = (id) => one("SELECT status, payment_status, total_paise FROM orders WHERE id=?", [id]);
  const payRow = (id) => one("SELECT status, provider_order_id, provider_payment_id, signature_verified, amount_refunded_paise, failure_code FROM payments WHERE order_id=?", [id]);
  const reserved = async () => (await one("SELECT reserved FROM inventory WHERE variant_id=?", [variantId])).reserved;
  const eventCount = async (id, status) => (await one("SELECT COUNT(*) n FROM order_events WHERE order_id=? AND status=?", [id, status])).n;

  // ---------- configuration ----------
  const opts = (await alice.call("GET", "/api/store/checkout/options")).json.data.map((o) => o.id);
  check("razorpay offered once Test keys are configured", opts.includes("razorpay"));

  // ---------- order creation + server-side amount ----------
  const o1 = await place(2);
  check("checkout with razorpay creates a PENDING order", o1.status === 201 && o1.json.data.status === "PENDING_PAYMENT" && o1.json.data.paymentStatus === "PENDING");
  const id1 = o1.json.data.orderId;
  check("stock reserved for the pending order", (await reserved()) === 2);
  check("nothing is confirmed without payment", (await orderRow(id1)).status === "PENDING_PAYMENT");
  const listed = async (c, path) => ((await c.call("GET", path)).json?.data ?? []).some((o) => String(o.id) === String(id1));
  check("unpaid draft is NOT in the customer's orders", !(await listed(alice, "/api/store/orders")));
  check("unpaid draft is NOT in Admin's order list", !(await listed(admin, "/api/orders")));

  const start = await alice.call("POST", "/api/store/payments/razorpay/order", { orderId: id1, amount: 1, amountPaise: 1 });
  check("start payment returns key id + server-computed amount ", start.status === 200 && start.json.data.amountPaise === (await orderRow(id1)).total_paise && start.json.data.keyId === "rzp_test_mockkey", JSON.stringify({ a: start.json?.data?.amountPaise }));
  check("response never contains the key secret", !JSON.stringify(start.json).includes(KEY_SECRET));
  const rzOrder = start.json.data.razorpayOrderId;
  check("razorpay order amount matches DB (not client)", orders.get(rzOrder)?.amount === (await orderRow(id1)).total_paise);
  const again = await alice.call("POST", "/api/store/payments/razorpay/order", { orderId: id1 });
  check("repeat start re-uses the same razorpay order (no duplicates)", again.json.data.razorpayOrderId === rzOrder && orders.size === 1);
  check("another customer can't start payment for it (404)", (await mallory.call("POST", "/api/store/payments/razorpay/order", { orderId: id1 })).status === 404);
  check("signed-out can't start payment (401)", (await new Client().call("POST", "/api/store/payments/razorpay/order", { orderId: id1 })).status === 401);

  // ---------- verification ----------
  const pay1 = `pay_ZZ${stamp}a`;
  setPayment({ id: pay1, order_id: rzOrder, amount: (await orderRow(id1)).total_paise });
  const v = (body, c = alice) => c.call("POST", "/api/store/payments/razorpay/verify", { orderId: id1, razorpay_order_id: rzOrder, razorpay_payment_id: pay1, razorpay_signature: sign(rzOrder, pay1), ...body });
  check("invalid signature rejected", (await v({ razorpay_signature: "0".repeat(64) })).status === 400);
  check("signature for a different payment rejected", (await v({ razorpay_signature: sign(rzOrder, "pay_other") })).status === 400);
  check("wrong razorpay order id rejected", (await v({ razorpay_order_id: "order_OTHER1" })).status === 400);
  check("failed verification confirmed nothing", (await orderRow(id1)).status === "PENDING_PAYMENT");
  check("another customer can't verify it (404)", (await v({}, mallory)).status === 404);

  setPayment({ id: `pay_ZZ${stamp}bad`, order_id: rzOrder, amount: 100 });
  const bad = await v({ razorpay_payment_id: `pay_ZZ${stamp}bad`, razorpay_signature: sign(rzOrder, `pay_ZZ${stamp}bad`) });
  check("correct signature but wrong amount is NOT confirmed", bad.status === 409 && (await orderRow(id1)).status === "PENDING_PAYMENT");
  setPayment({ id: `pay_ZZ${stamp}fail`, order_id: rzOrder, amount: (await orderRow(id1)).total_paise, status: "failed" });
  const notCaptured = await v({ razorpay_payment_id: `pay_ZZ${stamp}fail`, razorpay_signature: sign(rzOrder, `pay_ZZ${stamp}fail`) });
  check("verified signature but payment not captured stays pending", notCaptured.json?.data?.status === "pending" && (await orderRow(id1)).status === "PENDING_PAYMENT");

  const ok1 = await v({});
  check("valid payment confirms the order", ok1.status === 200 && ok1.json.data.status === "paid");
  check("once paid, the order appears for the customer and in Admin", (await listed(alice, "/api/store/orders")) && (await listed(admin, "/api/orders")));
  check("order CONFIRMED + payment CAPTURED + signature recorded", (await orderRow(id1)).status === "CONFIRMED" && (await payRow(id1)).status === "CAPTURED" && (await payRow(id1)).signature_verified === 1 && (await payRow(id1)).provider_payment_id === pay1);
  const ok2 = await v({});
  check("duplicate verify is idempotent (no second PAID event)", ok2.status === 200 && (await eventCount(id1, "PAID")) === 1 && (await eventCount(id1, "CONFIRMED")) === 1);

  // ---------- webhooks ----------
  const wBadSig = await webhook("payment.captured", entity({ id: pay1, order_id: rzOrder, amount: 1, currency: "INR", status: "captured" }), { secret: "wrong-secret" });
  check("webhook with wrong secret rejected (401)", wBadSig.status === 401);
  const wTamper = await webhook("payment.captured", entity({ id: pay1, order_id: rzOrder, amount: 106000, currency: "INR", status: "captured" }), { tamper: true });
  check("webhook with tampered body rejected (401)", wTamper.status === 401);
  check("unsigned webhook rejected", (await fetch(`${BASE}/api/store/payments/razorpay/webhook`, { method: "POST", body: "{}" })).status === 401);

  const cap = await webhook("payment.captured", entity({ id: pay1, order_id: rzOrder, amount: (await orderRow(id1)).total_paise, currency: "INR", status: "captured" }));
  check("valid webhook accepted", cap.status === 200);
  const dup = await fetch(`${BASE}/api/store/payments/razorpay/webhook`, { method: "POST", headers: { "x-razorpay-signature": createHmac("sha256", WEBHOOK_SECRET).update(cap.raw).digest("hex"), "x-razorpay-event-id": cap.eventId }, body: cap.raw });
  check("duplicate delivery of the same event is a no-op", (await dup.json()).outcome === "duplicate" && (await eventCount(id1, "PAID")) === 1);
  check("event id stored exactly once", (await one("SELECT COUNT(*) n FROM webhook_events WHERE provider='RAZORPAY' AND event_id=?", [cap.eventId])).n === 1);

  // out of order: failed → retry → captured webhook
  const o2 = await place(1);
  const id2 = o2.json.data.orderId;
  const rz2 = (await alice.call("POST", "/api/store/payments/razorpay/order", { orderId: id2 })).json.data.razorpayOrderId;
  const total2 = (await orderRow(id2)).total_paise;
  await webhook("payment.failed", entity({ id: `pay_ZZ${stamp}f2`, order_id: rz2, amount: total2, currency: "INR", status: "failed", error_code: "BAD_REQUEST_ERROR", error_description: "Card declined" }));
  check("failed payment event marks order PAYMENT_FAILED", (await orderRow(id2)).status === "PAYMENT_FAILED" && (await payRow(id2)).failure_code === "BAD_REQUEST_ERROR");
  await alice.call("POST", "/api/store/payments/razorpay/order", { orderId: id2 });
  check("retry puts the order back to awaiting payment (same razorpay order)", (await orderRow(id2)).status === "PENDING_PAYMENT" && (await payRow(id2)).provider_order_id === rz2);
  await webhook("payment.captured", entity({ id: `pay_ZZ${stamp}ok2`, order_id: rz2, amount: total2, currency: "INR", status: "captured" }));
  check("captured after an earlier failure confirms the order", (await orderRow(id2)).status === "CONFIRMED");
  await webhook("payment.failed", entity({ id: `pay_ZZ${stamp}late`, order_id: rz2, amount: total2, currency: "INR", status: "failed" }));
  check("a LATE failure event can't undo a confirmed payment", (await orderRow(id2)).status === "CONFIRMED" && (await payRow(id2)).status === "CAPTURED");

  const wMismatch = await webhook("payment.captured", entity({ id: `pay_ZZ${stamp}mm`, order_id: rz2, amount: 5, currency: "INR", status: "captured" }));
  check("webhook with a different amount doesn't alter a settled order", wMismatch.status === 200 && (await payRow(id2)).provider_payment_id === `pay_ZZ${stamp}ok2`);

  // refund
  const total1 = (await orderRow(id1)).total_paise;
  await webhook("refund.processed", { refund: { entity: { id: `rfnd_ZZ${stamp}`, payment_id: pay1, amount: 10000 } } });
  check("partial refund recorded", (await payRow(id1)).amount_refunded_paise === 10000 && (await orderRow(id1)).payment_status === "PARTIALLY_REFUNDED");
  await webhook("refund.processed", { refund: { entity: { id: `rfnd_ZZ${stamp}b`, payment_id: pay1, amount: total1 - 10000 } } });
  check("full refund recorded", (await orderRow(id1)).payment_status === "REFUNDED" && (await payRow(id1)).status === "REFUNDED");

  // ---------- expiry + late payment ----------
  const o3 = await place(3);
  const id3 = o3.json.data.orderId;
  const rz3 = (await alice.call("POST", "/api/store/payments/razorpay/order", { orderId: id3 })).json.data.razorpayOrderId;
  const before = await reserved();
  await db.query("UPDATE orders SET placed_at = NOW(3) - INTERVAL 3 HOUR WHERE id = ?", [id3]); // age only my own throwaway order
  check("expire endpoint rejects a bad secret", (await fetch(`${BASE}/api/store/payments/expire`, { method: "POST", headers: { Authorization: "Bearer nope" } })).status === 401);
  check("expire endpoint rejects no secret", (await fetch(`${BASE}/api/store/payments/expire`, { method: "POST" })).status === 401);
  const exp = await fetch(`${BASE}/api/store/payments/expire`, { method: "POST", headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  check("expiry cancels the stale unpaid order", exp.status === 200 && (await orderRow(id3)).status === "CANCELLED");
  check("expiry released its reserved stock (3 units)", (await reserved()) === before - 3);
  const late = await webhook("payment.captured", entity({ id: `pay_ZZ${stamp}lt`, order_id: rz3, amount: (await orderRow(id3)).total_paise, currency: "INR", status: "captured" }));
  check("late payment on a cancelled order is flagged, not silently confirmed", late.status === 200 && (await orderRow(id3)).status === "CANCELLED" && (await payRow(id3)).status === "CAPTURED" && (await one("SELECT COUNT(*) n FROM order_events WHERE order_id=? AND message LIKE '%after this order was cancelled%'", [id3])).n === 1);

  // ---------- data integrity + secrets ----------
  check("stock reservations correct: 2 confirmed orders hold 3 units, the expired one released its 3", (await reserved()) === 3, String(await reserved()));
  check("customer can't read another customer's order", (await mallory.call("GET", `/api/store/orders/${id1}`)).status === 404);
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(`${d}/${f}`).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]));
  let leaked = false;
  try {
    for (const f of walk(`${process.env.NEXT_DIST_DIR || ".next"}/static`).filter((f) => /\.(js|css|map|html)$/.test(f))) {
      const t = readFileSync(f, "utf8");
      if (t.includes(KEY_SECRET) || t.includes(WEBHOOK_SECRET) || t.includes(CRON_SECRET)) leaked = true;
    }
  } catch { /* no build output yet */ }
  check("no secret appears in the client bundle", !leaked);
} finally {
  for (const id of created.orders) {
    await db.query("DELETE FROM inventory_movements WHERE order_id = ?", [id]);
    await db.query("DELETE FROM order_events WHERE order_id = ?", [id]);
    await db.query("DELETE FROM payments WHERE order_id = ?", [id]);
    await db.query("DELETE FROM order_items WHERE order_id = ?", [id]);
    await db.query("DELETE FROM orders WHERE id = ?", [id]);
  }
  if (created.events.length) await db.query("DELETE FROM webhook_events WHERE provider='RAZORPAY' AND event_id IN (?)", [created.events]);
  if (created.product) {
    await db.query("DELETE FROM inventory_movements WHERE inventory_id IN (SELECT i.id FROM inventory i JOIN product_variants v ON v.id=i.variant_id WHERE v.product_id=?)", [created.product]);
    await db.query("DELETE FROM inventory WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id=?)", [created.product]);
    await db.query("DELETE FROM product_variants WHERE product_id=?", [created.product]);
    await db.query("DELETE FROM products WHERE id=?", [created.product]);
  }
  for (const id of created.customers) {
    await db.query("DELETE FROM addresses WHERE customer_id=?", [id]);
    await db.query("DELETE FROM customers WHERE id=?", [id]);
  }
  await db.query("UPDATE counters SET value = ? WHERE name='order_number'", [counterBefore]);
  await testAdmin.cleanup();
  const left = await one("SELECT (SELECT COUNT(*) FROM customers WHERE email LIKE 'zz.rzp.%') c, (SELECT COUNT(*) FROM products WHERE sku LIKE 'ZZ-RZP-%') p, (SELECT COUNT(*) FROM webhook_events WHERE event_id LIKE 'zz-evt-%') w");
  console.log(`cleanup: leftover customers=${left.c} products=${left.p} webhook rows=${left.w}`);
  await db.end();
  mock.close();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
