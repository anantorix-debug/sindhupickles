# Production deployment checklist

Nothing here has been done on a live server. Each step needs the owner's go-ahead. Tick items off in order.

## 1. Before anything else (owner decisions)

- [ ] Approve importing the 16 old WordPress products (`node scripts/migrate-wordpress.mjs --apply --owner-approved`). Dry run first; see DATA_MIGRATION_REPORT.md.
- [ ] Confirm shipping rules (fee/free-shipping threshold are placeholders until confirmed).
- [ ] Confirm real stock counts (the import sets stock to 0, so nothing is sellable until stock is entered).
- [ ] Approve Live Razorpay (see RAZORPAY_INTEGRATION.md). Live is never switched on without `RAZORPAY_LIVE_APPROVED=true`.
- [ ] Rotate every password that was pasted in chat (Razorpay dashboard, WordPress admin, the first admin login).

## 2. Server and database

- [ ] Node 20+ host (or Node-capable platform), MySQL 8 with automated daily backups.
- [ ] Create a dedicated MySQL user (not `root`) limited to the `sindhu` database; set a strong password.
- [ ] Nothing to import by hand: `npm run build` creates every missing table (and again at app start, as a safety net). Already-existing tables and data are never touched. See "Database migrations" below.
- [ ] Take a database backup **before** the first import and before every deploy.
- [ ] Uploaded product photos live in `uploads/` (git-ignored). Put it on a persistent volume and include it in backups.
- [ ] Static brand images live in `public/assets/images` and ship with the build.

## 3. Environment variables (production values, never committed)

Copy `.env.example` and fill in. Required:

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` (set by `next start`) |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | dedicated MySQL user |
| `AUTH_SECRET` | 32+ random bytes, unique to production |
| `NEXT_PUBLIC_SITE_URL` | `https://<real-domain>` (emails, sitemap, canonical, JSON-LD all use it; it is `http://localhost:3000` today) |
| `ENABLE_TEST_PAYMENTS` | unset / `false` (hides the fake "Test payment") |
| `ENABLE_COD` | optional starting value only; the real switch is Admin → Settings → Payment methods |
| `RAZORPAY_MODE` | `test` until approved, then `live` |
| `RAZORPAY_*_KEY_ID/SECRET/WEBHOOK_SECRET` | keys for the active mode only |
| `RAZORPAY_LIVE_APPROVED` | `true` only after written approval |
| `CRON_SECRET` | random; protects `/api/store/payments/expire` |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | real mail account so order/reset emails are actually sent (without it, production sends nothing) |
| `NEXT_PUBLIC_NOINDEX` | `true` on staging; **unset/false at launch** (see SEO_MIGRATION_AUDIT.md) |
| `ADMIN_AUTH` | **must be unset** in production (`off` is a local-dev escape hatch that disables admin sign-in) |
| `NEXT_PUBLIC_GTM_ID` | the old site's GTM container, if you still want it |
| `UNPAID_ORDER_EXPIRY_MINUTES` | optional; how long unpaid online orders hold stock |

## 4. Build and run

- [ ] `npm ci && npm run lint && npx tsc --noEmit && npm run build`
- [ ] `npm start` behind HTTPS (reverse proxy / platform TLS). Cookies are `Secure` in production, so HTTPS is mandatory.
- [ ] Do **not** run `next dev` in production.

## 5. Scheduled job

- [ ] Call `POST /api/store/payments/expire` every 5–10 minutes with header `Authorization: Bearer $CRON_SECRET`. It cancels unpaid online orders and releases their reserved stock.

## 6. Razorpay webhook

- [ ] Dashboard → Webhooks: URL `https://<domain>/api/store/payments/razorpay/webhook`, secret = `RAZORPAY_*_WEBHOOK_SECRET`, events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed` (and `refund.created`).
- [ ] Send a test event; confirm a row appears in `webhook_events` and the response is 200.

## 7. Admin

- [ ] First admin: set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` (and optionally `INITIAL_ADMIN_NAME`) in Hostinger before the first deploy. It is created once, only if no user exists. Remove those two variables afterwards. (Alternative: `scripts/make-admin-sql.mjs` prints SQL to run by hand in phpMyAdmin; running it again resets that password.)
- [ ] Sign in at `/admin/login`, change settings (business name, phone, email, WhatsApp, social links, shipping, and the Cash on delivery switch). Orders ship with ST Courier: enter the AWB number on each order and customers get a link to stcourier.com/track/shipment.
- [ ] Remove or disable any leftover test admins.

## 8. SEO cut-over (only when the old site is replaced)

- [ ] Point the domain at the new site; keep the old URLs redirecting (built in: `next.config.ts` + `docs/SEO_URL_REDIRECT_MAP.csv`).
- [ ] Submit `https://<domain>/sitemap.xml` in Search Console; check coverage and 404s for two weeks.
- [ ] Do not change slugs of imported products.

## 9. Smoke test on the live site (use a ₹1–low-value product, Test mode first)

- [ ] Browse, add to cart, register, add address, pay with Razorpay Test card `4111 1111 1111 1111`.
- [ ] Order shows Confirmed + Paid; confirmation email arrives; admin shows the order; `webhook_events` has the event.
- [ ] Only then switch to Live and place one real small order; refund it from the Razorpay dashboard.

## 10. After launch

- [ ] Monitor server logs and `webhook_events`; watch for orders flagged for review.
- [ ] Keep the archive in `data/wordpress-archive/` (not deployed) as a backup of the old site.

## Hostinger Node.js (Business plan) notes

- Hostinger always builds Next.js in server mode with `output: "standalone"` and starts the bundled server itself. Keep Output directory `.next`, Build command `npm run build`, Node 22.
- `next.config.ts` must stay a **plain exported object** (Hostinger ignores a function config and loses the redirects and standalone output).
- The build runs `scripts/build.mjs`, which caps the compiler's thread pools. Shared hosting limits threads per account (Business: about 120 processes/threads while running); an uncapped build aborts with "OS can't spawn worker thread: Resource temporarily unavailable". Extra caps can be set in Hostinger's Environment Variables: `TOKIO_WORKER_THREADS=1`, `RAYON_NUM_THREADS=1` (values set there win over the script's defaults).
- The build does not need the database: public pages and the sitemap are rendered on request.
- Uploaded photos are kept in ONE fixed folder that every deploy keeps: `UPLOAD_DIR` if set, otherwise (on Hostinger Web Apps) `<site>/uploads` beside the per-deploy `hbuilds` folders. `/api/store/health` shows `uploadDirSet: true` when this is in effect. Locally they stay in `./uploads`.
- Environment variables entered in hPanel are read at build time too, so `NEXT_PUBLIC_*` values must be present before you deploy.

## Database migrations (automatic, safe to repeat)

- `npm run build` (and the app at start-up) applies the files in `db/migrations/` in order. The database remembers which ones ran in the `schema_migrations` table, so every deploy skips what is already done. If the build machine cannot reach the database, the build still succeeds and the app applies them when it starts.
- **Only additive.** The runner refuses a migration that drops, truncates, deletes, updates, renames, replaces or alters/removes an existing column, or uses `ON DUPLICATE KEY UPDATE`. Allowed: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN`, `INSERT IGNORE`. A deliberate exception needs `.allow-data-change.` in the file name.
- **To change the database later:** add a NEW file, for example `db/migrations/001_add_wishlist.sql`. Never edit a file that has already been released (the runner warns if one was edited after it was applied and does not re-run it). `ALTER TABLE ... ADD COLUMN` is not repeatable by itself, which is fine: each file runs only once.
- **No sample data is seeded.** The only seed is the one-time first admin (above). The order-number counter and the welcome coupon from Admin → Settings are created by the app the first time they are needed.
- Several servers or deploys starting together take turns (database lock). Tests: `node scripts/migrate-smoke.mjs` (rules), `node scripts/fresh-deploy-smoke.mjs` (first deploy + redeploys end to end). `npm run migrate` runs the same migrations by hand.
