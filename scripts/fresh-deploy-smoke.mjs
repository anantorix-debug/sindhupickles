// End-to-end "first deploy, then redeploy" test on a THROWAWAY database (zz_fresh_deploy). It never touches the real shop DB.
//  1. `npm run build` against an EMPTY database -> tables + first admin are created by the build itself
//  2. start the built app, sign in as that admin, add a category + product, take an order using the welcome coupon
//  3. simulate redeploys (build + start again, with a DIFFERENT initial-admin password in the settings)
//     -> nothing is re-seeded, the owner's password and data are untouched, order numbers keep counting
// Takes a couple of minutes (two production builds). Needs a local MySQL where root has no password.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import mysql from "mysql2/promise";

const DB = "zz_fresh_deploy";
const PORT = 3114;
const BASE = `http://localhost:${PORT}`;
const DIST = ".next-fd";
const ADMIN = { email: "owner.fresh@example.com", password: "first-deploy-password-1" };
const OWNER_NEW_PASSWORD = "owner-chosen-new-password-9";

let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

const baseEnv = { ...process.env, DB_HOST: "localhost", DB_PORT: "3306", DB_NAME: DB, DB_USER: "root", DB_PASSWORD: "", NEXT_DIST_DIR: DIST, AUTH_SECRET: "fresh-deploy-test-secret-0123456789abcdef", NEXT_PUBLIC_SITE_URL: BASE, ENABLE_TEST_PAYMENTS: "false", RAZORPAY_MODE: "test", RAZORPAY_LIVE_APPROVED: "false" };
const deployEnv = (initialPassword) => ({ ...baseEnv, INITIAL_ADMIN_EMAIL: ADMIN.email, INITIAL_ADMIN_PASSWORD: initialPassword, INITIAL_ADMIN_NAME: "Fresh Owner" });

const db = await mysql.createConnection({ host: "localhost", user: "root", multipleStatements: true });
const one = async (sql, p = []) => (await db.query(`USE ${DB}`), (await db.query(sql, p))[0][0]);
let server = null;

function build(env) {
  const r = spawnSync("npm", ["run", "build"], { env, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, log: `${r.stdout}\n${r.stderr}` };
}
async function start(env) {
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, shell: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try { if ((await fetch(BASE + "/api/store/health")).status < 600) return () => log; } catch {}
  }
  throw new Error("server did not start\n" + log);
}
function stop() {
  if (!server) return;
  spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { shell: true });
  server = null;
}
class Client {
  cookie = "";
  async call(method, path, body) {
    const res = await fetch(BASE + path, { method, headers: { Origin: BASE, ...(body ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() ?? []) this.cookie = [this.cookie, c.split(";")[0]].filter(Boolean).join("; ");
    return { status: res.status, json: await res.json().catch(() => null) };
  }
}

try {
  await db.query(`DROP DATABASE IF EXISTS ${DB}; CREATE DATABASE ${DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  // ---------- first deploy: the BUILD sets up the database
  const b1 = build(deployEnv(ADMIN.password));
  check("first build succeeds", b1.ok, b1.ok ? "" : b1.log.slice(-600));
  check("build log: tables created by the build", /\[migrate\] applied 000_base_schema\.sql/.test(b1.log));
  check("build log: first admin created (one-time)", /first admin created/.test(b1.log));
  check("database has all 30 tables + ledger, exactly 1 user, nothing else seeded", (await one("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = ?", [DB])).n === 31 && (await one("SELECT COUNT(*) n FROM users")).n === 1 && (await one("SELECT COUNT(*) n FROM categories")).n === 0 && (await one("SELECT COUNT(*) n FROM coupons")).n === 0);

  const getLog1 = await start(deployEnv(ADMIN.password));
  check("app start-up: database already up to date (nothing to do)", /database already up to date/.test(getLog1()));
  const health = await (await fetch(BASE + "/api/store/health")).json();
  check("health check is green on a brand-new database", health.db === "ok" && health.tables >= 30, JSON.stringify(health));

  // ---------- use the shop as the new owner
  const admin = new Client();
  const login = await admin.call("POST", "/api/admin-auth/login", { email: ADMIN.email, password: ADMIN.password });
  check("seeded admin can sign in", login.status === 200 && login.json?.data?.role === "owner");
  const cat = await admin.call("POST", "/api/categories", { name: "Fish Pickles", slug: "fish-pickles", description: "", parentId: null, active: true });
  check("owner adds a category", cat.status === 201, JSON.stringify(cat.json?.error ?? ""));
  const prod = await admin.call("POST", "/api/products", { name: "Fresh Deploy Pickle", sku: "FD-1", categoryId: Number(cat.json?.data?.id), subcategoryId: null, price: 200, salePrice: null, status: "active", featured: false, spiceLevel: 2, shortDescription: "x", description: "Product added after the first deploy." });
  check("owner adds a product", prod.status === 201, JSON.stringify(prod.json?.error ?? ""));
  const variantId = prod.json?.data?.variants?.[0]?.id;
  await admin.call("PATCH", `/api/inventory/${variantId}`, { onHand: 10, reason: "first stock" });
  const settings = (await admin.call("GET", "/api/settings")).json.data;
  check("owner switches Cash on delivery on", (await admin.call("PUT", "/api/settings", { ...settings, codEnabled: true })).status === 200);

  const shop = new Client();
  const email = `fresh.${Date.now()}@example.com`;
  const reg = await shop.call("POST", "/api/store/auth/register", { name: "Fresh Buyer", email, phone: "9876543210", password: "Passw0rdOne", confirmPassword: "Passw0rdOne" });
  const addr = await shop.call("POST", "/api/store/addresses", { type: "Home", fullName: "Fresh Buyer", phone: "9876543210", line1: "1 Test Street", line2: "", area: "Anna Nagar", city: "Salem", district: "Salem", state: "Tamil Nadu", pincode: "636030", landmark: "", isDefault: true });
  check("customer registers and saves an address", reg.status === 201 && addr.status === 201);
  const o1 = await shop.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 1 }], addressId: addr.json.data.id, paymentMethod: "cod", couponCode: "SINDHU05" });
  check("first order uses the welcome coupon (created on first use) and is ANX-1001", o1.status === 201 && o1.json.data.orderNumber === "ANX-1001", JSON.stringify(o1.json?.data ?? o1.json?.error));
  const row1 = await one("SELECT subtotal_paise, discount_paise, total_paise FROM orders WHERE order_number = 'ANX-1001'");
  check("welcome discount is 5% of ₹200 = ₹10", row1.subtotal_paise === 20000 && row1.discount_paise === 1000);
  check("coupon row now exists, used once", (await one("SELECT used_count FROM coupons WHERE code='SINDHU05'")).used_count === 1);
  const again = await shop.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 1 }], addressId: addr.json.data.id, paymentMethod: "cod", couponCode: "SINDHU05" });
  check("the same customer can't reuse the first-order coupon", again.status >= 400);
  const o2 = await shop.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 1 }], addressId: addr.json.data.id, paymentMethod: "cod" });
  check("next order is ANX-1002", o2.status === 201 && o2.json.data.orderNumber === "ANX-1002");

  // the owner chooses a NEW password after the first deploy (same SQL helper the owner would use): redeploys must not undo it
  const reset = spawnSync("node", ["scripts/make-admin-sql.mjs", ADMIN.email, "Fresh Owner"], { env: { ...process.env, NEW_PASSWORD: OWNER_NEW_PASSWORD }, encoding: "utf8" });
  await db.query(`USE ${DB}`);
  await db.query(reset.stdout);
  const ownerLogin = await new Client().call("POST", "/api/admin-auth/login", { email: ADMIN.email, password: OWNER_NEW_PASSWORD });
  check("owner changed the password: new one works, the initial one no longer does", ownerLogin.status === 200 && (await new Client().call("POST", "/api/admin-auth/login", { email: ADMIN.email, password: ADMIN.password })).status === 401);
  const before = {
    users: (await one("SELECT COUNT(*) n FROM users")).n, orders: (await one("SELECT COUNT(*) n FROM orders")).n,
    hash: (await one("SELECT password_hash h FROM users WHERE email = ?", [ADMIN.email])).h,
    cats: (await one("SELECT COUNT(*) n FROM categories")).n, products: (await one("SELECT COUNT(*) n FROM products")).n,
    counter: Number((await one("SELECT value FROM counters WHERE name='order_number'")).value),
  };
  stop();

  // ---------- redeploy #1 and #2: different initial password in the settings, everything must stay the same
  for (const attempt of [1, 2]) {
    const env = deployEnv(`a-different-password-${attempt}`);
    const b = build(env);
    check(`redeploy ${attempt}: build succeeds and reports nothing to do`, b.ok && /database already up to date/.test(b.log) && !/first admin created/.test(b.log), b.ok ? "" : b.log.slice(-500));
    await start(env);
    stop();
  }
  const after = {
    users: (await one("SELECT COUNT(*) n FROM users")).n, orders: (await one("SELECT COUNT(*) n FROM orders")).n,
    hash: (await one("SELECT password_hash h FROM users WHERE email = ?", [ADMIN.email])).h,
    cats: (await one("SELECT COUNT(*) n FROM categories")).n, products: (await one("SELECT COUNT(*) n FROM products")).n,
    counter: Number((await one("SELECT value FROM counters WHERE name='order_number'")).value),
  };
  check("after redeploys: users, orders, categories, products, order counter all unchanged", JSON.stringify(before) === JSON.stringify({ ...after, hash: before.hash }) && before.counter === after.counter);
  check("after redeploys: the admin's password hash is byte-for-byte the same", before.hash === after.hash);

  await start(deployEnv("a-different-password-3"));
  const ownerPw = await new Client().call("POST", "/api/admin-auth/login", { email: ADMIN.email, password: OWNER_NEW_PASSWORD });
  const logins = await Promise.all([ADMIN.password, "a-different-password-1", "a-different-password-2", "a-different-password-3"].map((password) => new Client().call("POST", "/api/admin-auth/login", { email: ADMIN.email, password })));
  check("after redeploys: the password the owner chose still works", ownerPw.status === 200);
  check("after redeploys: neither the initial nor any later settings password works (nothing re-seeded)", logins.every((r) => r.status === 401));
  const o3 = await shop.call("POST", "/api/store/checkout", { items: [{ variantId, quantity: 1 }], addressId: addr.json.data.id, paymentMethod: "cod" });
  check("customer session survives redeploys; order numbering continues (ANX-1003)", o3.status === 201 && o3.json.data.orderNumber === "ANX-1003", JSON.stringify(o3.json?.data ?? o3.json?.error));
} catch (err) {
  failed++;
  console.log("FAIL  unexpected error:", err.message.slice(0, 800));
} finally {
  stop();
  await db.query(`DROP DATABASE IF EXISTS ${DB}`).catch(() => undefined);
  await db.end().catch(() => undefined);
  rmSync(DIST, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
