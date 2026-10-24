// Loads every public AND admin page against a running server (dev or prod) and checks each one renders:
// HTTP 200 (or the expected redirect), has an <h1>, and shows no Next.js error markers. Admin pages are loaded
// with a throwaway admin's session; dynamic pages use real ids from the database. Read-only apart from the
// throwaway admin, which is removed afterwards.
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { createTestAdmin } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3001";
const LOG = process.env.SERVER_LOG;
const logStart = LOG ? readFileSync(LOG, "utf8").length : 0;

let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

const db = await mysql.createConnection({ host: "localhost", user: "root", database: "sindhu", timezone: "Z" });
const admin = await createTestAdmin(db, BASE);
const one = async (sql) => (await db.query(sql))[0][0];

const ERROR_MARKERS = [/Application error/i, /Unhandled Runtime Error/i, /Internal Server Error/i, /__next_error__/, /This page couldn.t load/i, /ECONNREFUSED/];

async function page(path, { cookie = "", expect = 200, h1 = true } = {}) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });
  const html = expect === 200 ? await res.text() : "";
  const bad = ERROR_MARKERS.find((re) => re.test(html));
  const okStatus = res.status === expect;
  const okH1 = expect !== 200 || !h1 || /<h1[\s>]/.test(html);
  check(`${path.padEnd(34)} ${expect === 200 ? "renders" : `→ ${expect}`}`, okStatus && !bad && okH1, okStatus ? (bad ? `error marker ${bad}` : okH1 ? "" : "no <h1>") : `HTTP ${res.status}`);
  return html;
}

try {
  check("throwaway admin signed in", admin.status === 200 && !!admin.cookie);

  // ---------- public site ----------
  const prod = await one("SELECT p.id, p.slug FROM products p JOIN categories c ON c.id=p.category_id WHERE p.status='ACTIVE' AND c.active=1 ORDER BY p.id LIMIT 1");
  const cat = await one("SELECT slug FROM categories WHERE parent_id IS NULL AND active=1 ORDER BY id LIMIT 1");
  for (const p of ["/", "/shop", "/shop?q=pickle", "/shop?sort=price-asc", "/categories", `/categories/${cat.slug}`, `/product/${prod.slug}`, "/cart", "/login", "/register", "/forgot-password", "/contact", "/about", "/policies/shipping-return-refund", "/policies/privacy", "/policies/terms"]) await page(p);
  await page("/product/does-not-exist", { expect: 404 });
  await page("/categories/does-not-exist", { expect: 404 });
  await page("/policies/nope", { expect: 404 });
  await page("/checkout", { expect: 307 });
  await page("/account", { expect: 307 });
  for (const p of ["/sitemap.xml", "/robots.txt"]) {
    const r = await fetch(BASE + p);
    check(`${p.padEnd(34)} served`, r.status === 200);
  }
  const home = await (await fetch(BASE + "/")).text();
  check("home has the logo image", /logo\.webp|_next\/image[^"]*logo/.test(home));
  check("home has JSON-LD organization", /"@type":"Organization"/.test(home));

  // ---------- admin panel (signed in) ----------
  const c = admin.cookie;
  const order = await one("SELECT id FROM orders ORDER BY id LIMIT 1");
  const cust = await one("SELECT id FROM customers ORDER BY id LIMIT 1");
  const adminPages = ["/admin/dashboard", "/admin/products", "/admin/products/new", `/admin/products/${prod.id}`, `/admin/products/${prod.id}/edit`, "/admin/orders", `/admin/orders/${order.id}`, "/admin/customers", `/admin/customers/${cust.id}`, "/admin/categories", "/admin/reviews", "/admin/blog", "/admin/blog/new", "/admin/enquiries", "/admin/inventory", "/admin/payments", "/admin/reports", "/admin/settings"];
  for (const p of adminPages) await page(p, { cookie: c });
  await page("/admin", { cookie: c, expect: 307 });
  // Streaming sends a 200 shell before the not-found UI replaces it, so check the message (and noindex) instead of the status.
  for (const p of ["/admin/orders/99999999", "/admin/products/99999999", "/admin/customers/99999999"]) {
    const h = await (await fetch(BASE + p, { headers: { Cookie: c } })).text();
    check(`${p.padEnd(34)} shows "not found"`, /couldn.t find that/i.test(h) && /noindex/.test(h));
  }

  // ---------- admin locked when signed out ----------
  for (const p of ["/admin/dashboard", "/admin/products", "/admin/orders", "/admin/settings"]) await page(p, { expect: 307 });
  const login = await page("/admin/login");
  check("admin sign-in page shows the form", /type="password"/.test(login));

  // ---------- admin API sanity (signed in) ----------
  for (const p of ["/api/products", "/api/orders", "/api/customers", "/api/payments", "/api/inventory", "/api/dashboard", "/api/reports", "/api/settings", "/api/categories", "/api/blog", "/api/reviews", "/api/enquiries"]) {
    const r = await fetch(BASE + p, { headers: { Cookie: c } });
    const j = await r.json().catch(() => null);
    check(`GET ${p.padEnd(22)} returns data`, r.status === 200 && j && "data" in j);
  }

  // ---------- server log must stay clean ----------
  if (LOG) {
    await new Promise((r) => setTimeout(r, 500));
    const fresh = readFileSync(LOG, "utf8").slice(logStart);
    const errs = fresh.split("\n").filter((l) => /⨯|\[api\]|Error:|uncaughtException|Unhandled/.test(l) && !/\[mail:dev\]/.test(l));
    check("no server errors logged during the sweep", errs.length === 0, errs.slice(0, 2).join(" | ").slice(0, 200));
  }
} finally {
  await admin.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
