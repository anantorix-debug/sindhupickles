# Security audit (self-review of this codebase)

Scope: what was built and tested here. This is not a third-party penetration test.

## In place

| Area | Control |
|---|---|
| Passwords | scrypt with per-user salt; constant-time compare; minimum strength enforced |
| Sessions | HMAC-signed, httpOnly, SameSite cookies; separate cookies and signing contexts for customers (`sindhu_customer`) and admins (`sindhu_admin`); `Secure` in production |
| Admin | every `/api/*` admin route and `/admin/*` page requires an admin session (proxy + per-route check); signed-out requests redirect/401 (verified by the sweep) |
| Customer data | order, address and payment routes are scoped to the signed-in customer; other customers get 404 |
| CSRF | same-origin check on state-changing requests |
| Abuse | in-memory rate limiter on login/register/reset/checkout/contact/newsletter; honeypot fields on public forms |
| Input | Zod validation on every API body; parameterised SQL everywhere (mysql2 placeholders) |
| Prices | always recomputed server-side (cart, coupons, shipping, Razorpay amount) |
| Stock | transactions with `FOR UPDATE`; reservations released on failure/expiry |
| Payments | server-side signature + amount verification, webhook raw-body HMAC, idempotent events (see RAZORPAY_INTEGRATION.md) |
| Uploads | 3 MB limit, image types only, random filenames, served through a controlled route (no path traversal) |
| Secrets | only in env files / host env; `.env.local` is git-ignored; checked that no secret appears in responses or the client bundle |
| Errors | production responses carry no stack traces; admin "not found" pages are `noindex` |
| Indexing | admin, account, checkout, cart are `noindex` |

## Known limitations / to do before or soon after launch

1. **Rate limiter is per-process memory.** Fine for one server; with several instances or serverless it must move to Redis/DB.
2. **No HTTP security headers configured yet** (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy). Add at the reverse proxy or in `next.config.ts` `headers()`. A CSP must allow `checkout.razorpay.com` (script, frame), `api.razorpay.com`, `lumberjack.razorpay.com`, and Google Tag Manager if enabled.
3. **Database user**: dev uses `root` with an empty password. Production must use a dedicated least-privilege user with a strong password, and MySQL must not be exposed publicly.
4. **Credentials shared in chat** (Razorpay dashboard login, WordPress login, admin password) must be rotated. They were never written to the repo or logs.
5. **Old WordPress admin password format** from the original backend was only verified best-effort; a new admin account was created instead.
6. **Email**: with no SMTP configured, production sends no emails (including password resets). Configure SMTP before launch.
7. **Backups and monitoring** are an ops task: DB backups, uploads backup, uptime and error alerts.
8. **Dependency audit**: run `npm audit` and update before launch; Next.js 16 here has breaking changes, so re-run all suites after any upgrade.
9. **No automated browser/UI tests** (checks are API/HTTP level plus manual screenshots).

10. **`ADMIN_AUTH=off`** is a local-development escape hatch that disables admin sign-in. It must never be set in production (it is not set in `.env.local`).

11. **Password reset without email check (owner's choice, on by default).** While Admin → Settings → "Reset password without email check" is on, the Forgot password page sets a new password from just the account email, so anyone who knows a customer's email can take over that account (name, phone, addresses, order history). Limits: 3 changes per email and 5 per client address per hour; each change is logged (`[auth] customer password changed…`). Switch it off once SMTP is configured: the page then sends a reset link by email (or, with no SMTP, asks customers to contact the shop, and the owner uses Admin → Customers → "Set new password").

## Test evidence (run in this session)

- `eslint` and `tsc --noEmit`: clean.
- Production build: succeeds.
- `e2e-sweep` (all public + admin pages, signed-out lock-out, admin APIs, clean server log): passes on the production build.
- `api-smoke`, `admin-auth-smoke`: pass on the production build. `store-smoke`: passes against the dev server (it reads the dev mailer log, which production intentionally doesn't write).
- `razorpay-smoke` (42 checks): passes on the production build with the mock gateway.
- `razorpay-testmode-check` (real Razorpay Test API): passes.
