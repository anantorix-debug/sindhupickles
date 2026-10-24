# Data migration report (WordPress → new store)

## What exists

- A full archive of the old public site is saved in `data/wordpress-archive/` (REST API JSON, every page's HTML, 16 product images, sitemaps, robots, Rank Math SEO data). It is the safety net for when the old site is deleted.
- `scripts/migrate-wordpress.mjs` plans and performs the product import. **Default is a dry run that writes nothing.**

## Dry-run result (run today, nothing written)

| | Old site | Current database | After import |
|---|---|---|---|
| Products | 16 | 11 | 27 |
| Packs / variants | 16 | 16 | 32 |
| Images | 16 | 33 | 49 |
| Sum of product prices | ₹4,165 | ₹3,972 | ₹8,137 |
| Units in stock | not tracked | 353 | 353 (+0) |

All 16 products are planned as `create` with the **same slugs as the old URLs** (so rankings and links keep working), one pack each (100g or 250g, taken from the product name), categories mapped to Chicken / Mutton / Fish / Prawn pickles.

## Important: the current 11 products are placeholders

The 11 products currently on the store are earlier seed/sample data, not the real range. If you import without handling them, customers would see 27 products, 11 of them fake. Options:

1. Import the 16 and archive the 11 placeholders: `node scripts/migrate-wordpress.mjs --apply --owner-approved --archive-placeholders` (archived, not deleted; reversible from Admin).
2. Edit the 11 by hand in Admin to match the real products (slower, risk of wrong prices).

Recommended: option 1, after a backup.

## Commands

```
node scripts/migrate-wordpress.mjs                       # dry run (safe)
node scripts/migrate-wordpress.mjs --rehearse            # does all the inserts inside a transaction, then rolls back
node scripts/migrate-wordpress.mjs --apply --owner-approved [--archive-placeholders]   # real write
```

Real write refuses to run without `--owner-approved`. It records an id map in `wp_import_map` and SEO fields in `product_seo`, so re-running does not duplicate.

## Not migrated (and why)

| Item | Status |
|---|---|
| Stock counts | Not public on the old site. Imported at **0** → products show out of stock until you enter real stock in Admin → Inventory. |
| Customers and past orders | Need WordPress admin access / a database export; not available from the public site. Ask the owner for a WooCommerce export (CSV) if history must be kept. |
| Newsletter subscribers (Jetpack) | Need WordPress admin export. |
| Coupons | Old coupon list not public; welcome code `SINDHU05`/`PICKLES` text is configured in Admin settings. |
| Shipping zones/rates | Old Flexible Shipping rules not visible. Current fee/threshold are placeholders: confirm with the owner. |
| WhatsApp number | Not on the public pages; set in Admin → Settings. |
| Blog | Only the default "Hello world" post existed; it redirects to the home page. |

## Rollback

Before applying: back up the `sindhu` database. After applying: imported products can be set to draft/archived in Admin; the import map allows cleanly identifying them. Nothing is deleted by the script.
