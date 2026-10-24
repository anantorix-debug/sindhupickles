// WordPress (WooCommerce) -> new store catalogue migration. Reads ONLY the local archive in data/wordpress-archive
// (captured from the old site's public pages and Store API), so it works after the old site is gone and needs no
// WordPress login. No credentials are read, stored or printed.
//
//   node scripts/migrate-wordpress.mjs                 DRY RUN (default): read archive, map, compare, print. Writes nothing.
//   node scripts/migrate-wordpress.mjs --rehearse      Runs every INSERT inside a transaction, reports, then ROLLS BACK.
//   node scripts/migrate-wordpress.mjs --apply --owner-approved
//                                                       Writes products, variants, images, SEO and the id map.
//   add --archive-placeholders (with --apply) to set the placeholder products from the earlier build to ARCHIVED
//   (reversible; nothing is deleted).
//
// Plan A (default, recommended for SEO): every WordPress product becomes one product with the SAME slug, so every
// /product/<slug>/ URL keeps working. Existing rows are never overwritten: a slug that already exists is skipped.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";

// Everything is read from the local archive (scripts/archive...: data/wordpress-archive), so this works after the old site is gone.
const ARCHIVE = process.env.WP_ARCHIVE ?? "data/wordpress-archive";
const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const REHEARSE = args.has("--rehearse");
if (APPLY && !args.has("--owner-approved")) {
  console.error("Refusing to write: --apply also requires --owner-approved (the owner must approve the reconciliation first).");
  process.exit(1);
}

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}

const decode = (s) => s.replace(/&#0?39;|&#8217;|&rsquo;/g, "'").replace(/&amp;|&#038;/g, "&").replace(/&quot;|&#8220;|&#8221;/g, '"').replace(/&nbsp;/g, " ").replace(/&#8211;|&ndash;/g, "–").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const htmlToText = (h) =>
  decode(
    (h ?? "")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/(p|h[1-6]|ul|ol|div)>/gi, "\n")
      .replace(/<br[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// Which new category each product belongs to (the new store is organised by flavour; WordPress by pack weight).
// Chenna Kunni Thokku is dried shrimp, so it goes under Prawn.
const FLAVOUR = [
  [/chicken/i, "chicken-pickles"],
  [/mutton/i, "mutton-pickles"],
  [/chenna kunni|prawn|shrimp/i, "prawn-pickles"],
  [/fish|tuna|nethili|pal sura|dryfish/i, "fish-pickles"],
];

const readJson = (f) => JSON.parse(readFileSync(path.join(ARCHIVE, "api", f), "utf8"));
const products = readJson("products.json");
// Rank Math titles/descriptions were captured from each product page when the archive was made (seo.json).
const seoRows = new Map(
  readJson("seo.json").map((r) => [new URL(r.url).pathname.replace(/\/$/, "").split("/").pop(), { title: decode(r.title ?? "").trim(), description: decode(r.desc ?? "").trim() }]),
);

const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? "sindhu",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  timezone: "Z",
});
await db.query("SET time_zone = '+00:00'");

const [cats] = await db.query("SELECT id, slug FROM categories WHERE parent_id IS NULL");
const catId = new Map(cats.map((c) => [c.slug, c.id]));
const [existing] = await db.query("SELECT slug, sku FROM products");
const haveSlug = new Set(existing.map((e) => e.slug));
const [mapped] = await db.query("SELECT wp_id FROM wp_import_map WHERE wp_type = 'product'");
const haveWp = new Set(mapped.map((m) => m.wp_id));

const plan = products.map((p) => {
  const minor = Number(p.prices.currency_minor_unit ?? 2);
  const price = Number(p.prices.price) / 10 ** minor;
  const flavour = FLAVOUR.find(([re]) => re.test(p.name))?.[1];
  // The "Grams" attribute lists every pack size on every product, so the product's own pack is read from its name ("... – 250g").
  const packMatch = p.name.match(/(\d+)\s*g(?![a-z])/i);
  const grams = packMatch ? `${packMatch[1]}g` : "";
  const seo = seoRows.get(p.slug);
  const problems = [];
  if (!flavour) problems.push("no flavour category matched");
  else if (!catId.has(flavour)) problems.push(`category ${flavour} missing`);
  if (!p.images?.length) problems.push("no image");
  if (!(price > 0)) problems.push("no price");
  if (!grams) problems.push("pack size not found in name");
  return {
    wpId: p.id, slug: p.slug, name: decode(p.name), price, grams, flavour, url: new URL(p.permalink).pathname, images: (p.images ?? []).map((i) => ({ ...i, file: path.join(ARCHIVE, "images", path.basename(new URL(i.src).pathname)) })),
    short: htmlToText(p.short_description), description: htmlToText(p.description), metaTitle: seo?.title, metaDescription: seo?.description,
    skip: haveSlug.has(p.slug) ? "slug already exists in the new store" : haveWp.has(p.id) ? "already imported" : null, problems,
  };
});

console.log(`\nWordPress products: ${plan.length}   (mode: ${APPLY ? "APPLY" : REHEARSE ? "REHEARSE (rolled back)" : "DRY RUN"})`);
console.table(plan.map((p) => ({ wp: p.wpId, slug: p.slug, price: `₹${p.price}`, pack: p.grams, category: p.flavour, images: p.images.length, action: p.skip ? `skip: ${p.skip}` : p.problems.length ? `BLOCKED: ${p.problems.join(", ")}` : "create" })));
// ---- totals: old site (archive) vs current store (database) ----
const [[cur]] = await db.query(
  `SELECT COUNT(*) products, COALESCE(SUM(status='ACTIVE'),0) active, COALESCE(SUM(price_paise),0) paise,
          (SELECT COUNT(*) FROM product_variants) variants, (SELECT COUNT(*) FROM product_images) images,
          (SELECT COALESCE(SUM(on_hand),0) FROM inventory) units FROM products`,
);
const oldPaise = plan.reduce((s, p) => s + Math.round(p.price * 100), 0);
console.log("\nTotals — old site (archive) vs current store (database)");
console.table({
  products: { old: plan.length, current: cur.products, "after import": cur.products + plan.filter((p) => !p.skip).length },
  "variants / packs": { old: plan.length, current: cur.variants, "after import": cur.variants + plan.filter((p) => !p.skip).length },
  images: { old: plan.reduce((s, p) => s + p.images.length, 0), current: cur.images, "after import": cur.images + plan.filter((p) => !p.skip).reduce((s, p) => s + p.images.length, 0) },
  "sum of product prices (₹)": { old: oldPaise / 100, current: Number(cur.paise) / 100, "after import": (Number(cur.paise) + plan.filter((p) => !p.skip).reduce((s, p) => s + Math.round(p.price * 100), 0)) / 100 },
  "units in stock": { old: "not tracked", current: Number(cur.units), "after import": `${Number(cur.units)} (+0: imported stock starts at 0)` },
});
const [placeholders] = await db.query("SELECT COUNT(*) n FROM products WHERE sku NOT LIKE 'WP-%' AND status <> 'ARCHIVED'");
console.log(`Existing non-WordPress products currently visible: ${placeholders[0].n}  (earlier placeholder/seed data — see docs/DATA_MIGRATION_REPORT.md)`);
console.log(`Total old catalogue value (sum of prices): ₹${plan.reduce((s, p) => s + p.price, 0)}`);

if (!APPLY && !REHEARSE) {
  console.log("\nDry run only — nothing was written. Re-run with --rehearse to test the inserts safely (always rolls back).");
  await db.end();
  process.exit(0);
}

const blocked = plan.filter((p) => p.problems.length);
if (blocked.length) {
  console.error(`\n${blocked.length} product(s) have blocking problems; fix the mapping first.`);
  await db.end();
  process.exit(1);
}

const UPLOADS = path.join(process.cwd(), "uploads", "products");
const written = [];

/** Reads an archived original, re-encodes it as WebP (<= 1200px wide, well under the 3 MB limit). */
async function readImage(file) {
  const buf = await sharp(readFileSync(file)).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  if (buf.length > 3 * 1024 * 1024) throw new Error(`image ${file} still > 3 MB after re-encoding`);
  return buf;
}

await db.beginTransaction();
let created = 0;
try {
  for (const p of plan.filter((x) => !x.skip)) {
    const [res] = await db.query(
      `INSERT INTO products (name, slug, description, short_description, sku, category_id, price_paise, status, featured, rating_avg, review_count, spice_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, 0, 0, 0, NOW(3), NOW(3))`,
      [p.name, p.slug, p.description || p.name, p.short.slice(0, 500) || null, `WP-${p.wpId}`, catId.get(p.flavour), Math.round(p.price * 100)],
    );
    const productId = res.insertId;
    const grams = Number((p.grams.match(/\d+/) ?? [0])[0]) || null;
    const [v] = await db.query(
      "INSERT INTO product_variants (product_id, sku, label, size, weight_grams, position, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 1, NOW(3), NOW(3))",
      [productId, `WP-${p.wpId}-${p.grams || "STD"}`, p.grams || "Standard", p.grams || null, grams],
    );
    // WordPress didn't track quantities (everything was simply "in stock"), so we can't invent a number.
    await db.query("INSERT INTO inventory (variant_id, on_hand, reserved, low_stock_threshold, updated_at) VALUES (?, 0, 0, 10, NOW(3))", [v.insertId]);
    await db.query("INSERT INTO product_seo (product_id, meta_title, meta_description) VALUES (?, ?, ?)", [productId, (p.metaTitle ?? "").slice(0, 255) || null, (p.metaDescription ?? "").slice(0, 500) || null]);
    await db.query("INSERT INTO wp_import_map (wp_id, wp_type, wp_slug, wp_url, product_id) VALUES (?, 'product', ?, ?, ?)", [p.wpId, p.slug, p.url, productId]);

    for (const [i, img] of p.images.entries()) {
      const bytes = await readImage(img.file); // also proves the archived file exists and converts
      if (REHEARSE) continue;
      mkdirSync(UPLOADS, { recursive: true });
      const name = `${randomUUID()}.webp`;
      writeFileSync(path.join(UPLOADS, name), bytes);
      written.push(path.join(UPLOADS, name));
      await db.query("INSERT INTO product_images (product_id, url, alt, position) VALUES (?, ?, ?, ?)", [productId, `/uploads/products/${name}`, img.alt || p.name, i]);
    }
    created++;
  }

  if (APPLY && args.has("--archive-placeholders")) {
    const [r] = await db.query("UPDATE products SET status = 'ARCHIVED', updated_at = NOW(3) WHERE sku NOT LIKE 'WP-%' AND status <> 'ARCHIVED'");
    console.log(`Archived ${r.affectedRows} placeholder product(s) (reversible).`);
  }

  const [[after]] = await db.query("SELECT (SELECT COUNT(*) FROM wp_import_map WHERE wp_type='product') mapped, (SELECT COUNT(*) FROM products WHERE sku LIKE 'WP-%') wpProducts, (SELECT COUNT(*) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.sku LIKE 'WP-%') variants, (SELECT COUNT(*) FROM product_images i JOIN products p ON p.id=i.product_id WHERE p.sku LIKE 'WP-%') images, (SELECT COALESCE(SUM(price_paise),0) FROM products WHERE sku LIKE 'WP-%') paise");
  console.log(`\nReconciliation: created ${created}/${plan.filter((x) => !x.skip).length}; mapped ${after.mapped}; products ${after.wpProducts}; variants ${after.variants}; images ${after.images}; price total ₹${after.paise / 100} (expected ₹${plan.filter((x) => !x.skip).reduce((s, p) => s + p.price, 0)})`);

  if (APPLY) {
    await db.commit();
    console.log("COMMITTED.");
  } else {
    await db.rollback();
    console.log("REHEARSAL complete — everything rolled back, database unchanged.");
  }
} catch (e) {
  await db.rollback();
  for (const f of written) {
    try { (await import("node:fs")).unlinkSync(f); } catch { /* already gone */ }
  }
  console.error("FAILED, rolled back:", e.message);
  process.exitCode = 1;
}
await db.end();
