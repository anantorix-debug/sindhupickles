# Feature parity: old WordPress site vs new store

Status: ✅ done and tested · ◐ done, needs owner input · ❌ not done

| Old site feature | New site | Status |
|---|---|---|
| Home page with hero, categories, products, reviews | Same sections, same dark/amber design | ✅ |
| Shop with product grid, search | `/shop` with search, sort, category filter | ✅ |
| Product categories | `/categories`, `/categories/[slug]`; managed in Admin | ✅ |
| Product pages (images, price, pack, description) | `/product/[slug]` with SEO + JSON-LD | ✅ (16 real products ◐ pending import) |
| Pack sizes 100g / 250g | Variants per product | ✅ |
| Cart | `/cart` (server re-prices, stock-checked) | ✅ |
| Checkout | Address, shipping fee, coupon, payment choice | ✅ |
| Cash on delivery | Admin → Settings toggle (off until switched on) | ✅ |
| Courier tracking | ST Courier is the default carrier; AWB + link to stcourier.com tracking on the order page | ✅ |
| Razorpay payments | Test mode verified (mock + real Test API); real card payment ◐; Live ❌ until approved | ◐ |
| My account | `/account`: profile, orders (with tracking), addresses, settings | ✅ |
| Register / login / forgot password | Done (direct reset by email + new password while the Admin → Settings switch is on; reset link needs SMTP) | ◐ |
| Order emails (customer + shop owner) | Done; production needs SMTP | ◐ |
| Privacy / Terms / Shipping-Return-Refund pages | `/policies/*` with real text | ✅ (owner to proof-read) |
| Contact page / enquiries | Form → Admin → Enquiries | ✅ |
| About page | Done | ✅ |
| Newsletter signup | Stored in DB; list viewable by Admin | ✅ |
| Reviews | Shown on site; moderated in Admin | ✅ |
| Blog | Admin blog manager exists; the old site had no real posts | ✅ |
| Coupons | Percent/flat coupons, welcome code | ✅ |
| WhatsApp / social links | Fields exist in Admin → Settings; values needed | ◐ |
| Old URLs keep working | One-hop redirects | ✅ |
| Customer + order history from WP | Needs WooCommerce export | ❌ |
| Jetpack subscribers | Needs export | ❌ |

## New (not on the old site)

Admin panel on the same database: dashboard, products, inventory, orders with status flow, customers, payments, reports, categories, reviews, blog, enquiries, settings, image upload (3 MB limit). Cash on delivery (Admin → Settings toggle).

## Honest gaps

- Live Razorpay and a real completed Test card payment are not yet verified.
- Shipping rules and stock counts are placeholders until confirmed.
- No customer/order/subscriber history from WordPress.
