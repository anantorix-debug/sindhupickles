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
- [ ] Import `db/schema.sql` once (hPanel → Databases → phpMyAdmin → Import). It creates all 30 tables plus the starter rows (order counter, 4 categories, welcome coupon). `scripts/migrate.mjs` is NOT enough on its own: it only adds tables on top of the base schema.
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

- [ ] Create the production admin: run `NEW_PASSWORD=... node scripts/make-admin-sql.mjs you@example.com "Your Name"` on your PC, then paste the one SQL statement it prints into phpMyAdmin → SQL on the live database (it prints only a password hash).
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
