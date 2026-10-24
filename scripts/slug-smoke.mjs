// Page-address (slug) control in Admin for products and categories. Uses throwaway "zz-" records that are removed
// afterwards. Start a server first:  BASE=http://localhost:3113 node scripts/slug-smoke.mjs
import mysql from "mysql2/promise";
import { createTestAdmin } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3113";
let failed = 0;
const check = (name, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };

const db = await mysql.createConnection({ host: "localhost", user: "root", database: process.env.DB_NAME ?? "sindhu" });
const admin = await createTestAdmin(db, BASE);
const call = async (method, path, body) => {
  const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", Cookie: admin.cookie, Origin: BASE }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const stamp = Date.now();
const made = { products: [], categories: [] };
const productBody = (name, extra = {}) => ({ name, sku: `ZZ-SLUG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, categoryId: made.cat, subcategoryId: null, price: 120, salePrice: null, status: "active", featured: false, spiceLevel: 0, shortDescription: "x", description: "Throwaway product for the page-address test.", ...extra });
const publicStatus = async (slug) => (await fetch(`${BASE}/product/${slug}`)).status;

try {
  check("throwaway admin signed in", admin.status === 200 && !!admin.cookie);

  // ---- categories (already supported): typed address kept, clash refused
  const c1 = await call("POST", "/api/categories", { name: `ZZ Cat ${stamp}`, slug: `zz-cat-${stamp}`, description: "", parentId: null, active: true });
  made.cat = Number(c1.json?.data?.id);
  made.categories.push(made.cat);
  check("category: typed address is kept exactly", c1.status === 201 && c1.json.data.slug === `zz-cat-${stamp}`);
  const c2 = await call("POST", "/api/categories", { name: "ZZ Other", slug: `zz-cat-${stamp}`, description: "", parentId: null, active: true });
  check("category: an address already in use is refused (409)", c2.status === 409);

  // ---- products: typed address is the page address
  const old = `zz-tuna-fish-pickle-online-100g-${stamp}`;
  const p1 = await call("POST", "/api/products", productBody("ZZ Tuna Fish Pickle – 100g", { slug: old }));
  made.products.push(p1.json?.data?.id);
  check("product: the typed old address is used exactly", p1.status === 201 && p1.json.data.slug === old, p1.json?.data?.slug);
  check("product: its page opens at that address", (await publicStatus(old)) === 200);

  const dup = await call("POST", "/api/products", productBody("ZZ Another", { slug: old }));
  check("product: the same address can't be used twice (409 + message on the slug field)", dup.status === 409 && !!dup.json?.error?.fields?.slug, dup.json?.error?.fields?.slug);

  const auto = await call("POST", "/api/products", productBody(`ZZ Auto Name ${stamp}`));
  made.products.push(auto.json?.data?.id);
  check("product: no address typed -> made from the name", auto.status === 201 && auto.json.data.slug === `zz-auto-name-${stamp}`, auto.json?.data?.slug);

  const upper = await call("POST", "/api/products", productBody("ZZ Upper", { slug: `ZZ-Upper-${stamp}` }));
  made.products.push(upper.json?.data?.id);
  check("product: capital letters are lower-cased", upper.status === 201 && upper.json.data.slug === `zz-upper-${stamp}`);

  const bad = await call("POST", "/api/products", productBody("ZZ Bad", { slug: "has spaces & symbols" }));
  check("product: spaces/symbols are rejected (422)", bad.status === 422 && !!bad.json?.error?.fields?.slug);

  // ---- editing
  const id = p1.json.data.id;
  const same = await call("PUT", `/api/products/${id}`, productBody("ZZ Tuna renamed", { slug: "", sku: p1.json.data.sku }));
  check("edit: empty address keeps the current one", same.status === 200 && same.json.data.slug === old && same.json.data.name === "ZZ Tuna renamed");
  const taken = await call("PUT", `/api/products/${id}`, productBody("ZZ Tuna", { slug: auto.json.data.slug, sku: p1.json.data.sku }));
  check("edit: moving to another product's address is refused (409)", taken.status === 409);
  const moved = `zz-moved-${stamp}`;
  const mv = await call("PUT", `/api/products/${id}`, productBody("ZZ Tuna", { slug: moved, sku: p1.json.data.sku }));
  check("edit: a new address is applied", mv.status === 200 && mv.json.data.slug === moved);
  check("edit: the product now opens at the new address and not the old one", (await publicStatus(moved)) === 200 && (await publicStatus(old)) === 404);
  const own = await call("PUT", `/api/products/${id}`, productBody("ZZ Tuna", { slug: moved, sku: p1.json.data.sku }));
  check("edit: saving with its own address unchanged is fine", own.status === 200);
} finally {
  for (const id of made.products.filter(Boolean)) await call("DELETE", `/api/products/${id}`);
  for (const id of made.categories.filter(Boolean)) await call("DELETE", `/api/categories/${id}`);
  await db.query("DELETE FROM products WHERE slug LIKE 'zz-%'").catch(() => undefined);
  await db.query("DELETE FROM categories WHERE slug LIKE 'zz-%'").catch(() => undefined);
  await admin.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
