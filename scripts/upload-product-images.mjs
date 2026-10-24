// Uploads product photos through the ADMIN API (the same endpoints the admin screen uses), to any running copy of the shop.
//
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... BASE=https://your-site node scripts/upload-product-images.mjs [--dry-run] [--stock 50]
//
//  * 250g jars: the front photo (+ the back label as a 2nd photo) from PHOTOS_DIR (default "D:/pickles image").
//  * 100g jars: the photo the OLD website used (data/wordpress-archive/images) - a stand-in until the original files exist.
// With --stock N, every pack of these products that is at 0 in stock is set to N (a pack that already has stock is left alone).
// Safe to repeat: a product that already has any photo is skipped, so nothing is duplicated or replaced.
// Photos are resized to 1200px WebP first (well under the 3 MB upload limit). The password is only sent to BASE's sign-in.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BASE = (process.env.BASE ?? "http://localhost:3001").replace(/\/$/, "");
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const DRY = process.argv.includes("--dry-run");
const stockFlag = process.argv.indexOf("--stock");
const STOCK = stockFlag > -1 ? Number(process.argv[stockFlag + 1]) : null;
if (STOCK !== null && (!Number.isInteger(STOCK) || STOCK < 0 || STOCK > 100000)) {
  console.error("--stock needs a whole number, for example --stock 50");
  process.exit(1);
}
const PHOTOS_DIR = process.env.PHOTOS_DIR ?? "D:/pickles image";
const OLD_SITE = path.join(process.env.WP_ARCHIVE ?? "data/wordpress-archive", "images");

// slug -> [{ file, alt }]  (first = main photo)
const dsc = (n) => path.join(PHOTOS_DIR, `DSC00${n}_1.png`);
const old = (n) => path.join(OLD_SITE, `${n}.png`);
const PLAN = {
  "boneless-chicken-pickle-250g": [[dsc(286), "front"], [dsc(287), "back label"]],
  "nethili-dryfish-pickle-online-250g": [[dsc(291), "front"], [dsc(292), "back label"]],
  "pal-sura-dryfish-pickle-online-250g": [[dsc(294), "front"], [dsc(296), "back label"]],
  "prawn-pickle-online-250g": [[dsc(299), "front"], [dsc(300), "back label"]],
  "mutton-pickle-online-250g": [[dsc(302), "front"], [dsc(304), "back label"]],
  "chenna-kunni-thokku-250g": [[dsc(306), "front"], [dsc(308), "back label"]],
  "tuna-fish-pickle-online-250g": [[dsc(310), "front"], [dsc(311), "back label"]],
  "fish-pickle-online-250g": [[dsc(313), "front"], [dsc(314), "back label"]],
  "tuna-fish-pickle-online-100g": [[old(1), "front"]],
  "prawn-pickle-online-100g": [[old(3), "front"]],
  "pal-sura-dryfish-pickle-online-100g": [[old(4), "front"]],
  "nethili-dryfish-pickle-online-100g": [[old(5), "front"]],
  "mutton-pickle-online-100g": [[old(6), "front"]],
  "fish-pickle-online-100g": [[old(7), "front"]],
  "chenna-kunni-thokku-100g": [[old(8), "front"]],
  "boneless-chicken-pickle-100g": [[old(9), "front"]],
};

if (!EMAIL || !PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (and BASE) first.");
  process.exit(1);
}
const missing = Object.values(PLAN).flat().map(([f]) => f).filter((f) => !existsSync(f));
if (missing.length) {
  console.error("Photo files not found:\n" + missing.join("\n"));
  process.exit(1);
}

let cookie = "";
async function call(method, p, body, form) {
  const res = await fetch(BASE + p, {
    method,
    headers: { Origin: BASE, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  for (const c of res.headers.getSetCookie?.() ?? []) cookie = [cookie, c.split(";")[0]].filter(Boolean).join("; ");
  return { status: res.status, json: await res.json().catch(() => null) };
}

const login = await call("POST", "/api/admin-auth/login", { email: EMAIL, password: PASSWORD });
if (login.status !== 200) {
  console.error(`Sign-in to ${BASE} failed (HTTP ${login.status}): ${login.json?.error?.message ?? "unknown"}`);
  process.exit(1);
}
console.log(`Signed in to ${BASE} as ${login.json.data.name}${DRY ? "  (DRY RUN: nothing will be changed)" : ""}`);

const list = await call("GET", "/api/products");
const bySlug = new Map((list.json?.data ?? []).map((p) => [p.slug, p]));
let uploaded = 0, skipped = 0, absent = 0, failed = 0;

for (const [slug, photos] of Object.entries(PLAN)) {
  const product = bySlug.get(slug);
  if (!product) { console.log(`  ${slug.padEnd(40)} not in this shop - skipped`); absent++; continue; }
  if ((product.images?.length ?? 0) > 0) { console.log(`  ${slug.padEnd(40)} already has ${product.images.length} photo(s) - skipped`); skipped++; continue; }
  if (DRY) { console.log(`  ${slug.padEnd(40)} would upload ${photos.length} photo(s)`); continue; }
  try {
    for (const [file, what] of photos) {
      const bytes = await sharp(readFileSync(file)).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      const form = new FormData();
      form.set("file", new Blob([bytes], { type: "image/webp" }), `${slug}-${what.replace(/\s+/g, "-")}.webp`);
      form.set("folder", "products");
      const up = await call("POST", "/api/upload", null, form);
      if (!up.json?.data?.url) throw new Error(`upload failed (HTTP ${up.status}): ${up.json?.error?.message}`);
      const alt = `${product.name}${what === "front" ? "" : ` - ${what}`}`.slice(0, 250);
      const att = await call("POST", `/api/products/${product.id}/images`, { url: up.json.data.url, alt });
      if (att.status !== 201) throw new Error(`attach failed (HTTP ${att.status}): ${att.json?.error?.message}`);
    }
    console.log(`  ${slug.padEnd(40)} uploaded ${photos.length} photo(s)`);
    uploaded++;
  } catch (e) {
    console.log(`  ${slug.padEnd(40)} FAILED: ${e.message}`);
    failed++;
  }
}
console.log(`\nproducts uploaded: ${uploaded}, already had photos: ${skipped}, not in this shop: ${absent}, failed: ${failed}`);

// ---- optional: opening stock (only for packs that are at 0)
if (STOCK !== null) {
  let set = 0, kept = 0, stockFailed = 0;
  for (const slug of Object.keys(PLAN)) {
    const product = bySlug.get(slug);
    if (!product) continue;
    for (const v of product.variants ?? []) {
      if (v.onHand !== 0) { kept++; continue; }
      if (DRY) { console.log(`  ${slug.padEnd(40)} ${v.label}: would set stock to ${STOCK}`); continue; }
      const r = await call("PATCH", `/api/inventory/${v.id}`, { onHand: STOCK, reason: "Opening stock" });
      if (r.status === 200) set++;
      else { stockFailed++; console.log(`  ${slug.padEnd(40)} ${v.label}: stock FAILED (HTTP ${r.status}): ${r.json?.error?.message}`); }
    }
  }
  console.log(`stock: set to ${STOCK} on ${set} pack(s), left alone (already had stock): ${kept}, failed: ${stockFailed}`);
  failed += stockFailed;
}
process.exit(failed ? 1 : 0);
