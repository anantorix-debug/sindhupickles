# SEO migration audit

Goal: keep the ranking the old WordPress site earned.

## What was done

- **Same product URLs.** Imported products reuse the old slugs, so `/product/<slug>` pairs with the old product URLs (see `docs/SEO_URL_REDIRECT_MAP.csv`, 29 rows).
- **Redirects, one hop, permanent (308):** old WordPress paths map straight to their new location (`/my-account` → `/account`, `/privacy-policy` → `/policies/privacy`, `/terms-and-conditions` → `/policies/terms`, `/shipping-return-refund-policy` → `/policies/shipping-return-refund`, `/product-category/*` → `/shop`, old sitemap files → `/sitemap.xml`, trailing slash removed in the same hop). The rules are generated from `src/config/legacy-redirects.ts`; no old URLs are hard-coded in pages.
- **Titles, descriptions, keywords** scraped from Rank Math into `src/content/legacy-seo.ts` (built by `scripts/build-legacy-seo.mjs`) and applied to the matching product pages and the home page.
- **Technical SEO:** canonical URLs, Open Graph, `sitemap.xml` (products, categories, policies), `robots.txt`, JSON-LD (Organization with logo, Product with price/availability), `noindex` on cart/checkout/account/admin, descriptive image alt text, server-rendered pages with ISR for speed.
- Static brand images are in `public/assets/images`; product photos are uploaded through Admin.

## Verified

- All public pages render with an `<h1>` and no errors on the production build (e2e sweep).
- `/sitemap.xml` and `/robots.txt` are served.
- Redirect rules are generated from one list and build cleanly.

## Before launch (not yet done)

1. Set `NEXT_PUBLIC_SITE_URL` to the real https domain (currently `http://localhost:3000`). Canonicals, sitemap and JSON-LD depend on it.
2. Import the 16 products (DATA_MIGRATION_REPORT.md) so the old product URLs exist; until then they 404.
3. Keep `NEXT_PUBLIC_NOINDEX=true` on staging until cut-over; leave it unset in production so search engines can index.
4. After cut-over: submit the sitemap, then watch Search Console for 404s/“Crawled – not indexed” for 2–4 weeks and add redirects for any old URL that shows up.
5. Add a unique description for each product (the imported text comes from the old site; improve over time).
6. Check Google Tag Manager / analytics IDs if the old site used them (GTM is opt-in via env).

## Risks

- Slug differences between the CSV and the live domain if the domain/path structure changes: keep it as is.
- Products out of stock (stock is 0 after import) are still indexable but show "out of stock"; enter real stock before launch to avoid a ranking drop from unavailable products.
