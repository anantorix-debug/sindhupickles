// End-to-end check of the public storefront API against the real database.
// It creates its own throwaway product / customers / orders, and removes them (and restores the
// order counter and coupon usage) at the end. It never touches existing products, orders or stock.
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { createTestAdmin } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3111";
const LOG = process.env.SERVER_LOG; // server stdout, to read the dev "email" with the reset link
const LOG_START = LOG ? readFileSync(LOG, "utf8").length : 0;

let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

/** A tiny browser: keeps cookies per "user". */
class Client {
  cookie = "";
  async call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.endsWith("=") || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) this.cookie = "";
      else this.cookie = pair;
    }
    return { status: res.status, json: await res.json().catch(() => null) };
  }
}
const admin = new Client();
const alice = new Client();
const mallory = new Client();

const db = await mysql.createConnection({ host: "localhost", user: "root", database: "sindhu", timezone: "Z" });
const testAdmin = await createTestAdmin(db, BASE);
admin.cookie = testAdmin.cookie;
const one = async (sql, p = []) => (await db.query(sql, p))[0][0];

const stamp = Date.now();
const aliceEmail = `zz.alice.${stamp}@example.com`;
const malloryEmail = `zz.mallory.${stamp}@example.com`;
const counterBefore = (await one("SELECT value FROM counters WHERE name='order_number'")).value;
const couponBefore = (await one("SELECT used_count FROM coupons WHERE code='SINDHU05'")).used_count;
const created = { product: null, orders: [], customers: [], enquiry: false };
// The shop owner may have saved Settings with COD off; the checkout tests need it on, so the row is restored at the end.
let settingsBefore = null;
let settingsTouched = false;

try {
  // ---------- catalogue reflects admin changes ----------
  const prod = await admin.call("POST", "/api/products", {
    name: `ZZ Store Test ${stamp}`, sku: `ZZ-ST-${stamp}`, categoryId: 1, subcategoryId: null, price: 100, salePrice: 80, status: "active",
    featured: true, spiceLevel: 3, shortDescription: "Throwaway product", description: "Throwaway product used by the storefront test.",
  });
  check("admin creates product", prod.status === 201);
  created.product = prod.json.data.id;
  const variantId = prod.json.data.variants[0].id;
  const slug = prod.json.data.slug;
  await admin.call("PATCH", `/api/inventory/${variantId}`, { onHand: 5, reason: "storefront test" });

  const list = await admin.call("GET", `/api/store/products?q=ZZ%20Store%20Test%20${stamp}`);
  check("public search finds it", list.json.data.total === 1 && list.json.data.items[0].slug === slug);
  const detail = await admin.call("GET", `/api/store/products/${slug}`);
  check("sale price + compare-at shown", detail.json.data.price === 80 && detail.json.data.compareAtPrice === 100 && detail.json.data.inStock === true);
  check("public search by SKU", (await admin.call("GET", `/api/store/products?q=ZZ-ST-${stamp}`)).json.data.total === 1);
  check("category filter returns it", (await admin.call("GET", "/api/store/products?category=chicken-pickles&pageSize=48")).json.data.items.some((p) => p.slug === slug));

  const putBody = { name: `ZZ Store Test ${stamp}`, sku: `ZZ-ST-${stamp}`, categoryId: 1, subcategoryId: null, price: 100, salePrice: 80, featured: true, spiceLevel: 3, shortDescription: "Throwaway product", description: "Throwaway product used by the storefront test." };
  await admin.call("PUT", `/api/products/${created.product}`, { ...putBody, status: "draft" });
  check("draft product hidden from public", (await admin.call("GET", `/api/store/products/${slug}`)).status === 404);
  await admin.call("PUT", `/api/products/${created.product}`, { ...putBody, status: "active" });
  await admin.call("PATCH", `/api/inventory/${variantId}`, { onHand: 0 });
  check("stock 0 -> out of stock publicly", (await admin.call("GET", `/api/store/products/${slug}`)).json.data.inStock === false);
  await admin.call("PATCH", `/api/inventory/${variantId}`, { onHand: 5 });
  check("stock restored -> in stock", (await admin.call("GET", `/api/store/products/${slug}`)).json.data.inStock === true);

  // ---------- accounts ----------
  const reg = await alice.call("POST", "/api/store/auth/register", { name: "Alice Tester", email: aliceEmail, phone: "9876543210", password: "Passw0rdOne", confirmPassword: "Passw0rdOne" });
  check("register + auto sign-in", reg.status === 201 && alice.cookie.startsWith("sindhu_customer="));
  created.customers.push(reg.json.data.id);
  check("duplicate email rejected", (await mallory.call("POST", "/api/store/auth/register", { name: "X Y", email: aliceEmail, phone: "9876543211", password: "Passw0rdOne", confirmPassword: "Passw0rdOne" })).status === 409);
  check("weak password rejected", (await mallory.call("POST", "/api/store/auth/register", { name: "Mal Lory", email: malloryEmail, phone: "9876543211", password: "short", confirmPassword: "short" })).status === 422);
  check("existing seed customer can't be claimed", (await mallory.call("POST", "/api/store/auth/register", { name: "Ananya Iyer", email: "ananya.iyer@example.com", phone: "9876543211", password: "Passw0rdOne", confirmPassword: "Passw0rdOne" })).status === 409);
  check("me returns profile", (await alice.call("GET", "/api/store/auth/me")).json.data?.name === "Alice Tester");
  check("visitor me = null", (await new Client().call("GET", "/api/store/auth/me")).json.data === null);
  const bad = new Client();
  check("wrong password rejected", (await bad.call("POST", "/api/store/auth/login", { email: aliceEmail, password: "Wrongpass1" })).status === 401);
  check("unknown email gives same error", (await bad.call("POST", "/api/store/auth/login", { email: `nobody.${stamp}@example.com`, password: "Wrongpass1" })).json.error.message === "Incorrect email or password");
  check("cross-site POST blocked", (await new Client().call("POST", "/api/store/auth/login", { email: aliceEmail, password: "Passw0rdOne" }, { Origin: "http://evil.example" })).status === 403);
  const mal = await mallory.call("POST", "/api/store/auth/register", { name: "Mal Lory", email: malloryEmail, phone: "9876543211", password: "Passw0rdTwo", confirmPassword: "Passw0rdTwo" });
  created.customers.push(mal.json.data.id);

  // ---------- addresses ----------
  const addr = {
    type: "Home", fullName: "Alice Tester", phone: "9876543210", line1: "12 Test Street", line2: "", area: "Anna Nagar", city: "Chennai",
    district: "Chennai", state: "Tamil Nadu", pincode: "600040", landmark: "Near the park", isDefault: false,
  };
  const a1 = await alice.call("POST", "/api/store/addresses", addr);
  check("first address becomes default", a1.status === 201 && a1.json.data.isDefault === true && a1.json.data.area === "Anna Nagar" && a1.json.data.district === "Chennai");
  const a2 = await alice.call("POST", "/api/store/addresses", { ...addr, type: "Work", line1: "99 Office Road", isDefault: true });
  check("new default replaces old", (await alice.call("GET", "/api/store/addresses")).json.data.filter((a) => a.isDefault).length === 1);
  check("invalid pincode rejected", (await alice.call("POST", "/api/store/addresses", { ...addr, pincode: "12" })).status === 422);
  check("update address", (await alice.call("PUT", `/api/store/addresses/${a1.json.data.id}`, { ...addr, line1: "12A Test Street" })).json.data.line1 === "12A Test Street");
  check("another customer can't edit it", (await mallory.call("PUT", `/api/store/addresses/${a1.json.data.id}`, addr)).status === 404);
  check("another customer can't delete it", (await mallory.call("DELETE", `/api/store/addresses/${a1.json.data.id}`)).status === 404);
  check("deleting default promotes another", (await alice.call("DELETE", `/api/store/addresses/${a2.json.data.id}`)).status === 200 && (await alice.call("GET", "/api/store/addresses")).json.data[0].isDefault === true);
  const addressId = a1.json.data.id;

  // ---------- server-side cart pricing ----------
  const v1 = await alice.call("POST", "/api/store/cart/validate", { items: [{ variantId, quantity: 20 }], price: 1, total: 1 });
  check("quantity clamped to stock", v1.json.data.lines[0].quantity === 5 && v1.json.data.lines[0].issue === "reduced");
  const v2 = await alice.call("POST", "/api/store/cart/validate", { items: [{ variantId, quantity: 2 }], couponCode: "SINDHU05" });
  const t = v2.json.data.totals;
  check("price comes from the server (₹80 × 2)", v2.json.data.lines[0].unitPrice === 80 && t.subtotal === 160);
  check("first-order coupon: 5% off", t.discount === 8 && t.couponCode === "SINDHU05");
  check("shipping under free threshold", t.shipping === 60 && t.total === 212, JSON.stringify(t));
  check("unknown coupon reported", (await alice.call("POST", "/api/store/cart/validate", { items: [{ variantId, quantity: 1 }], couponCode: "NOPE" })).json.data.totals.couponError !== null);
  check("inactive coupon rejected", (await alice.call("POST", "/api/store/cart/validate", { items: [{ variantId, quantity: 1 }], couponCode: "DIWALI25" })).json.data.totals.couponError !== null);
  check("bad variant id handled", (await alice.call("POST", "/api/store/cart/validate", { items: [{ variantId: "99999999", quantity: 1 }] })).json.data.lines[0].issue === "unavailable");

  // ---------- checkout ----------
  check("checkout needs sign-in", (await new Client().call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 1 }], addressId, paymentMethod: "cod" })).status === 401);
  settingsBefore = await one("SELECT setting_value FROM store_settings WHERE setting_key='general'");
  const curSettings = (await admin.call("GET", "/api/settings")).json.data;
  settingsTouched = true;
  await admin.call("PUT", "/api/settings", { ...curSettings, codEnabled: true });
  const opts = (await alice.call("GET", "/api/store/checkout/options")).json.data.map((o) => o.id);
  check("payment options include cod + test (razorpay appears only when keys are configured)", opts.includes("cod") && opts.includes("mock"), opts.join(","));
  // Cash on delivery is an Admin → Settings toggle. Original settings row is restored afterwards.
  {
    const off = await admin.call("PUT", "/api/settings", { ...curSettings, codEnabled: false });
    check("admin can switch COD off", off.status === 200 && off.json.data.codEnabled === false);
    const optsOff = (await alice.call("GET", "/api/store/checkout/options")).json.data.map((o) => o.id);
    check("COD hidden at checkout when switched off", !optsOff.includes("cod"));
    const blocked = await alice.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 1 }], addressId, paymentMethod: "cod" });
    check("COD checkout rejected when switched off (422)", blocked.status === 422);
    const on = await admin.call("PUT", "/api/settings", { ...curSettings, codEnabled: true });
    check("admin can switch COD on", on.status === 200 && on.json.data.codEnabled === true);
    check("COD offered again when switched on", (await alice.call("GET", "/api/store/checkout/options")).json.data.some((o) => o.id === "cod"));
  }
  check("can't ship to someone else's address",(await mallory.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 1 }], addressId, paymentMethod: "cod" })).status === 422);
  const oversell = await alice.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 6 }], addressId, paymentMethod: "cod" });
  check("can't order more than stock (409 + fresh cart)", oversell.status === 409 && oversell.json.error.details?.cart?.lines?.length === 1);
  check("failed checkout changed nothing", (await one("SELECT reserved FROM inventory WHERE variant_id=?", [variantId])).reserved === 0 && (await one("SELECT value FROM counters WHERE name='order_number'")).value === counterBefore);

  const o1 = await alice.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 2 }], addressId, paymentMethod: "cod", couponCode: "SINDHU05", note: "Leave at the gate", total: 1, price: 1 });
  check("place COD order", o1.status === 201 && o1.json.data.orderNumber === `ANX-${counterBefore + 1}`, o1.json?.data?.orderNumber);
  created.orders.push(o1.json.data.orderId);
  const row = await one("SELECT * FROM orders WHERE id=?", [o1.json.data.orderId]);
  check("order totals computed server-side (₹212)", row.subtotal_paise === 16000 && row.discount_paise === 800 && row.shipping_paise === 6000 && row.total_paise === 21200, `${row.subtotal_paise}/${row.discount_paise}/${row.shipping_paise}/${row.total_paise}`);
  check("COD order confirmed, payment pending", row.status === "CONFIRMED" && row.payment_status === "PENDING" && row.payment_method === "COD" && row.coupon_code === "SINDHU05");
  check("address snapshot saved (incl. area + district)", row.ship_line1 === "12A Test Street" && row.ship_line2.includes("Anna Nagar") && row.ship_pincode === "600040" && row.customer_note === "Leave at the gate");
  check("order item snapshot", (await one("SELECT COUNT(*) n, MAX(quantity) q, MAX(unit_price_paise) u FROM order_items WHERE order_id=?", [row.id])).u === 8000);
  check("payment record created", (await one("SELECT status, amount_paise FROM payments WHERE order_id=?", [row.id])).amount_paise === 21200);
  check("stock reserved + movement logged", (await one("SELECT reserved FROM inventory WHERE variant_id=?", [variantId])).reserved === 2 && (await one("SELECT COUNT(*) n FROM inventory_movements WHERE order_id=? AND type='RESERVE'", [row.id])).n === 1);
  check("order timeline recorded", (await one("SELECT COUNT(*) n FROM order_events WHERE order_id=?", [row.id])).n >= 2);
  check("coupon usage counted", (await one("SELECT used_count FROM coupons WHERE code='SINDHU05'")).used_count === couponBefore + 1);
  check("first-order coupon now refused", (await alice.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 1 }], addressId, paymentMethod: "mock", couponCode: "SINDHU05" })).status === 422);

  const o2 = await alice.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 1 }], addressId, paymentMethod: "mock" });
  created.orders.push(o2.json?.data?.orderId);
  const row2 = await one("SELECT status, payment_status, shipping_paise FROM orders WHERE id=?", [o2.json.data.orderId]);
  check("test-payment order captured + confirmed", o2.status === 201 && row2.status === "CONFIRMED" && row2.payment_status === "CAPTURED" && row2.shipping_paise === 6000);
  check("counter advanced by 2", (await one("SELECT value FROM counters WHERE name='order_number'")).value === counterBefore + 2);

  // ---------- customer order pages + ownership ----------
  const mine = await alice.call("GET", "/api/store/orders");
  check("customer sees own orders", mine.json.data.length === 2);
  check("order detail", (await alice.call("GET", `/api/store/orders/${o1.json.data.orderId}`)).json.data.items.length === 1);
  check("other customer can't see it (404)", (await mallory.call("GET", `/api/store/orders/${o1.json.data.orderId}`)).status === 404);
  check("other customer sees none of Alice's", (await mallory.call("GET", "/api/store/orders")).json.data.length === 0);

  // ---------- admin status change reflects for the customer, with stock effects ----------
  await admin.call("PATCH", `/api/orders/${o1.json.data.orderId}`, { status: "processing" });
  await admin.call("PATCH", `/api/orders/${o1.json.data.orderId}`, { status: "shipped" });
  check("admin ships -> customer sees 'shipped'", (await alice.call("GET", `/api/store/orders/${o1.json.data.orderId}`)).json.data.status === "shipped");
  const inv = await one("SELECT on_hand, reserved FROM inventory WHERE variant_id=?", [variantId]);
  check("shipping consumed stock (5-2=3 on hand, 1 still reserved)", inv.on_hand === 3 && inv.reserved === 1, JSON.stringify(inv));
  await admin.call("PATCH", `/api/orders/${o2.json.data.orderId}`, { status: "cancelled" });
  check("cancel releases reservation", (await one("SELECT reserved FROM inventory WHERE variant_id=?", [variantId])).reserved === 0);
  check("public availability reflects it (3 left)", (await admin.call("GET", `/api/store/products/${slug}`)).json.data.variants[0].available === 3);

  // ---------- profile / password / preferences ----------
  check("update profile", (await alice.call("PATCH", "/api/store/account", { name: "Alice T", phone: "9876543299" })).json.data.name === "Alice T");
  check("wrong current password refused", (await alice.call("POST", "/api/store/account/password", { currentPassword: "nope12345", newPassword: "Passw0rdNew", confirmPassword: "Passw0rdNew" })).status === 422);
  check("change password", (await alice.call("POST", "/api/store/account/password", { currentPassword: "Passw0rdOne", newPassword: "Passw0rdNew", confirmPassword: "Passw0rdNew" })).status === 200);
  check("preferences saved", (await alice.call("PATCH", "/api/store/account/preferences", { orderUpdates: false, offers: true })).json.data.offers === true);
  check("logout clears session", (await alice.call("POST", "/api/store/auth/logout")).status === 200 && (await alice.call("GET", "/api/store/orders")).status === 401);
  check("old password no longer works", (await alice.call("POST", "/api/store/auth/login", { email: aliceEmail, password: "Passw0rdOne" })).status === 401);
  check("new password works", (await alice.call("POST", "/api/store/auth/login", { email: aliceEmail, password: "Passw0rdNew" })).status === 200);

  // ---------- forgot / reset password (dev mailer prints the link) ----------
  check("forgot password (unknown email: same answer)", (await new Client().call("POST", "/api/store/auth/forgot-password", { email: `ghost.${stamp}@example.com` })).json.data.sent === true);
  check("forgot password (real email)", (await new Client().call("POST", "/api/store/auth/forgot-password", { email: aliceEmail })).json.data.sent === true);
  if (LOG) {
    await new Promise((r) => setTimeout(r, 400));
    const token = [...readFileSync(LOG, "utf8").matchAll(/reset-password\?token=([A-Za-z0-9_-]+)/g)].at(-1)?.[1];
    check("reset link logged by dev mailer", Boolean(token));
    const c = new Client();
    check("reset with bad token refused", (await c.call("POST", "/api/store/auth/reset-password", { token: "x".repeat(43), password: "Passw0rdReset", confirmPassword: "Passw0rdReset" })).status === 400);
    check("reset password", (await c.call("POST", "/api/store/auth/reset-password", { token, password: "Passw0rdReset", confirmPassword: "Passw0rdReset" })).status === 200);
    check("reset link is single-use", (await c.call("POST", "/api/store/auth/reset-password", { token, password: "Passw0rdAgain1", confirmPassword: "Passw0rdAgain1" })).status === 400);
    check("login with reset password", (await c.call("POST", "/api/store/auth/login", { email: aliceEmail, password: "Passw0rdReset" })).status === 200);
  }

  // ---------- contact form -> admin enquiries ----------
  const enq = await new Client().call("POST", "/api/store/enquiries", { name: "ZZ Tester", email: `zz.enq.${stamp}@example.com`, phone: "", message: "Hello, this is a storefront test message." });
  check("contact enquiry saved", enq.status === 201);
  created.enquiry = true;
  check("honeypot blocks bots", (await new Client().call("POST", "/api/store/enquiries", { name: "Bot Bot", email: "bot@example.com", phone: "", message: "Buy my stuff now please", website: "http://spam" })).status === 422);
  check("appears in admin enquiries", (await admin.call("GET", "/api/enquiries")).json.data.some((e) => e.email === `zz.enq.${stamp}@example.com`));

  // ---------- newsletter ----------
  const nEmail = `zz.news.${stamp}@example.com`;
  check("newsletter subscribe", (await new Client().call("POST", "/api/store/newsletter", { email: nEmail })).status === 201);
  check("re-subscribing is harmless (no enumeration)", (await new Client().call("POST", "/api/store/newsletter", { email: nEmail })).status === 200);
  check("only one row stored", (await one("SELECT COUNT(*) n FROM newsletter_subscribers WHERE email=?", [nEmail])).n === 1);
  check("invalid newsletter email rejected", (await new Client().call("POST", "/api/store/newsletter", { email: "nope" })).status === 422);
  check("newsletter honeypot blocks bots", (await new Client().call("POST", "/api/store/newsletter", { email: `zz.news2.${stamp}@example.com`, website: "x" })).status === 422);

  // ---------- order emails (dev mailer prints them to the server log) ----------
  if (LOG) {
    await new Promise((r) => setTimeout(r, 300));
    const log = readFileSync(LOG, "utf8").slice(LOG_START); // only what this run produced
    const num = o1.json.data.orderNumber;
    const count = (re) => (log.match(re) ?? []).length;
    check("customer confirmation email sent once", count(new RegExp(`Subject: Your Sindhu's Pickles order ${num} is confirmed`, "g")) === 1);
    check("store notification email sent once", count(new RegExp(`Subject: New order ${num} `, "g")) === 1);
    check("one EMAIL marker on the order timeline", (await one("SELECT COUNT(*) n FROM order_events WHERE order_id=? AND type='EMAIL'", [o1.json.data.orderId])).n === 1);
  }
} finally {
  // ---------- cleanup: only rows this script created ----------
  if (settingsTouched) {
    if (settingsBefore) await db.query("UPDATE store_settings SET setting_value=? WHERE setting_key='general'", [JSON.stringify(settingsBefore.setting_value)]);
    else await db.query("DELETE FROM store_settings WHERE setting_key='general'");
  }
  for (const id of created.orders.filter(Boolean)) {
    await db.query("DELETE FROM inventory_movements WHERE order_id = ?", [id]);
    await db.query("DELETE FROM order_events WHERE order_id = ?", [id]);
    await db.query("DELETE FROM payments WHERE order_id = ?", [id]);
    await db.query("DELETE FROM order_items WHERE order_id = ?", [id]);
    await db.query("DELETE FROM orders WHERE id = ?", [id]);
  }
  if (created.product) {
    await db.query("DELETE FROM inventory_movements WHERE inventory_id IN (SELECT i.id FROM inventory i JOIN product_variants v ON v.id = i.variant_id WHERE v.product_id = ?)", [created.product]);
    await db.query("DELETE FROM inventory WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)", [created.product]);
    await db.query("DELETE FROM product_variants WHERE product_id = ?", [created.product]);
    await db.query("DELETE FROM products WHERE id = ?", [created.product]);
  }
  for (const id of created.customers.filter(Boolean)) {
    await db.query("DELETE FROM addresses WHERE customer_id = ?", [id]); // address_details cascade
    await db.query("DELETE FROM customers WHERE id = ?", [id]); // credentials + resets cascade
  }
  await db.query("DELETE FROM newsletter_subscribers WHERE email LIKE ?", [`zz.news%.${stamp}@example.com`]);
  if (created.enquiry) await db.query("DELETE FROM enquiries WHERE email LIKE ?", [`zz.enq.${stamp}@example.com`]);
  await db.query("UPDATE counters SET value = ? WHERE name='order_number'", [counterBefore]);
  await db.query("UPDATE coupons SET used_count = ? WHERE code='SINDHU05'", [couponBefore]);
  const left = (await one("SELECT (SELECT COUNT(*) FROM customers WHERE email LIKE 'zz.%') c, (SELECT COUNT(*) FROM products WHERE sku LIKE 'ZZ-ST-%') p, (SELECT COUNT(*) FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE 'zz.%')) o"));
  console.log(`cleanup: leftover customers=${left.c} products=${left.p} orders=${left.o}; counter restored to ${counterBefore}, coupon used_count restored to ${couponBefore}`);
  await testAdmin.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
