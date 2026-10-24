// Category pictures are managed in Admin (not fixed files): upload -> set on a category -> shown on the storefront.
// Uses throwaway "zz-" records and removes them (and the uploaded file) afterwards.
//   BASE=http://localhost:3113 node scripts/category-image-smoke.mjs
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { createTestAdmin } from "./_test-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3113";
let failed = 0;
const check = (name, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };

const db = await mysql.createConnection({ host: "localhost", user: "root", database: process.env.DB_NAME ?? "sindhu" });
const admin = await createTestAdmin(db, BASE);
const call = async (method, p, body) => {
  const res = await fetch(BASE + p, { method, headers: { "Content-Type": "application/json", Cookie: admin.cookie, Origin: BASE }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const stamp = Date.now();
const made = { product: null, category: null, file: null };

try {
  check("throwaway admin signed in", admin.status === 200 && !!admin.cookie);

  // 1. upload through the same endpoint the admin form uses
  const form = new FormData();
  form.set("file", new Blob([PNG], { type: "image/png" }), "zz.png");
  form.set("folder", "categories");
  const up = await fetch(`${BASE}/api/upload`, { method: "POST", headers: { Cookie: admin.cookie, Origin: BASE }, body: form });
  const upJson = await up.json().catch(() => null);
  const url = upJson?.data?.url;
  made.file = url;
  check("a category picture uploads into its own folder", up.status === 201 || up.status === 200, JSON.stringify(upJson?.error ?? url));
  check("the stored address is /uploads/categories/<file>", /^\/uploads\/categories\/[A-Za-z0-9._-]+$/.test(url ?? ""), url);
  check("the uploaded picture is served", (await fetch(BASE + url)).status === 200);

  // 2. set it on a category (create), and read it back
  const cat = await call("POST", "/api/categories", { name: `ZZ Pic Cat ${stamp}`, slug: `zz-pic-cat-${stamp}`, description: "", parentId: null, active: true, imageUrl: url });
  made.category = cat.json?.data?.id;
  check("category saves the picture", cat.status === 201 && cat.json.data.imageUrl === url, JSON.stringify(cat.json?.error ?? ""));

  // 3. an outside web address is refused (pictures must be uploaded)
  const evil = await call("POST", "/api/categories", { name: "ZZ Evil", slug: `zz-evil-${stamp}`, description: "", parentId: null, active: true, imageUrl: "https://example.com/x.png" });
  check("an outside picture link is refused (422)", evil.status === 422 && !!evil.json?.error?.fields?.imageUrl);
  const traversal = await call("POST", "/api/categories", { name: "ZZ Path", slug: `zz-path-${stamp}`, description: "", parentId: null, active: true, imageUrl: "/uploads/categories/../../etc/passwd" });
  check("a path-tricking picture address is refused (422)", traversal.status === 422);

  // 4. shows on the storefront: category API + the home page tile (needs a product in the category)
  const prod = await call("POST", "/api/products", { name: `ZZ Pic Product ${stamp}`, slug: `zz-pic-product-${stamp}`, sku: `ZZ-PIC-${stamp}`, categoryId: Number(made.category), subcategoryId: null, price: 100, salePrice: null, status: "active", featured: false, spiceLevel: 0, shortDescription: "x", description: "Throwaway product for the category picture test." });
  made.product = prod.json?.data?.id;
  const pub = (await (await fetch(`${BASE}/api/store/categories`)).json()).data.find((c) => c.slug === `zz-pic-cat-${stamp}`);
  check("storefront API returns the category's own picture", pub?.imageUrl === url, pub?.imageUrl);
  const home = await (await fetch(BASE + "/")).text();
  const tile = home.split(`/categories/zz-pic-cat-${stamp}`)[1]?.slice(0, 700) ?? "";
  check("the home page tile uses that picture", tile.replace(/%2F/gi, "/").includes("/uploads/categories/"), tile ? "" : "tile not found");
  check("no fixed category pictures are referenced any more", !home.includes("assets%2Fimages%2Fcategories") && !home.includes("/assets/images/categories"));

  // 5. editing: leaving the picture out keeps it; an empty string removes it
  const keep = await call("PUT", `/api/categories/${made.category}`, { name: `ZZ Pic Cat ${stamp}`, slug: `zz-pic-cat-${stamp}`, description: "edited", parentId: null, active: true });
  check("saving without a picture field keeps the current picture", keep.status === 200 && keep.json.data.imageUrl === url);
  const clear = await call("PUT", `/api/categories/${made.category}`, { name: `ZZ Pic Cat ${stamp}`, slug: `zz-pic-cat-${stamp}`, description: "edited", parentId: null, active: true, imageUrl: "" });
  check("an empty picture removes it", clear.status === 200 && clear.json.data.imageUrl === null);
  const pub2 = (await (await fetch(`${BASE}/api/store/categories`)).json()).data.find((c) => c.slug === `zz-pic-cat-${stamp}`);
  check("after removing, the storefront falls back to nothing/first product photo (no stale picture)", pub2?.imageUrl !== url);
} finally {
  if (made.product) await call("DELETE", `/api/products/${made.product}`);
  if (made.category) await call("DELETE", `/api/categories/${made.category}`);
  await db.query("DELETE FROM products WHERE slug LIKE 'zz-%'").catch(() => undefined);
  await db.query("DELETE FROM categories WHERE slug LIKE 'zz-%'").catch(() => undefined);
  if (made.file) {
    const f = path.join(process.cwd(), "uploads", "categories", path.basename(made.file));
    if (existsSync(f)) rmSync(f);
  }
  await admin.cleanup();
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
