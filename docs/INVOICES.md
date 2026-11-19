# Invoices

Every placed order has exactly one invoice. The shop owner can preview it and download it as an A4 PDF from
**Admin → Orders**, and customers can download their own from **My account → Orders** (also straight after checkout).

## When an invoice is issued

| Order | Invoice |
|---|---|
| Cash on delivery (or the dev-only test payment) | Issued in the **same database transaction** that places the order |
| Online (Razorpay) | Issued in the same transaction that marks the payment **captured** (checkout callback or webhook, whichever is first) |
| Online, unpaid or payment failed (`PENDING_PAYMENT`, `PAYMENT_FAILED`) | **None.** Every invoice endpoint answers 409 and nothing is created |
| Placed before invoices existed, or issuing failed for any reason | Issued the first time the order is opened (Admin → Orders lists it, the preview, the PDF or the API) |

Issuing runs inside a savepoint, so a problem with an invoice can never undo a placed order or a captured payment; it
is simply retried when the order is next opened. Opening **Admin → Orders** also issues any missing invoices for
older orders, oldest first, so the list shows a number for every order.

### Numbering

`INV-00001`, `INV-00002`, … from the `counters` table (`invoice_number`). Optional prefix: `INVOICE_NUMBER_PREFIX`
(default `INV`). The counter row is locked until the issuing transaction ends, so numbers are unique and sequential,
and a rolled-back attempt gives its number back. The order row is locked before checking for an existing invoice, so
simultaneous requests can never create two invoices for one order (tested with 6 parallel requests).

### What is frozen, what follows the order

Frozen when issued (stored in `invoices` + a JSON `snapshot`):
- the shop's name, address, phone, email and GSTIN from Admin → Settings
- the customer's name/email and the delivery address and phone used for the order
- every line: product name, pack, SKU, quantity, unit price, line total
- subtotal, discount (and coupon), shipping, tax, total

So later product renames, price changes, a customer editing their profile/addresses, or the owner editing Settings
never change an issued invoice.

Kept in step with the order: payment status, amount paid, refunds and balance due (e.g. cash collected later, a
refund). A cancelled/returned/refunded order keeps its invoice, marked with the status, with nothing due.

**Tax:** checkout does not charge GST, so orders carry no tax and the invoice shows no tax line. Nothing is invented.
If GST is added to checkout later, fill `tax_paise` from the order and the line appears automatically. The GSTIN is
printed when it is set in Admin → Settings → Store profile (optional, validated 15-character format).

## Database (migration `db/migrations/002_invoices.sql`)

New table only, applied automatically by `npm run build` / server start-up; no existing data is touched.

| Column | |
|---|---|
| `id` | PK |
| `invoice_number` | unique |
| `order_id` | unique, FK → `orders.id` |
| `invoice_date` | when issued |
| `subtotal_paise`, `discount_paise`, `shipping_paise`, `tax_paise`, `total_paise` | frozen amounts (paise) |
| `amount_paid_paise`, `refunded_paise`, `balance_due_paise`, `payment_status` | follow the order |
| `snapshot` | JSON (as LONGTEXT so MariaDB and MySQL behave the same) |
| `created_at`, `updated_at` | |

Indexes: `uq_invoices_number`, `uq_invoices_order`, `idx_invoices_date`.

## API

Admin endpoints need an admin session (401 otherwise); the customer endpoint only finds the signed-in customer's own
orders (anyone else's order is a 404, signed out is a 401).

| Method & path | |
|---|---|
| `GET /api/orders/:orderId/invoice` | Invoice details (JSON). Issued first if the placed order has none yet |
| `POST /api/orders/:orderId/invoice` | Issue if missing: **201** with the new invoice, or **200** with the existing one. Safe to repeat |
| `GET /api/orders/:orderId/invoice/download` | A4 PDF, `Content-Disposition: attachment; filename="Invoice_<order no>.pdf"`. `?inline=1` opens it in the browser |
| `GET /api/invoices/:invoiceId` | Invoice details by invoice id |
| `GET /api/store/orders/:orderId/invoice` | Customer: their own invoice PDF (`?inline=1` supported) |

Errors: `404` unknown order (or not yours), `409 not_placed` for unpaid/failed online orders.

## PDF

Server-side with `pdfkit` (pure JavaScript, no browser needed). Layout follows the client's sample: title + logo,
the shop's address top-right (GSTIN if set), "Bill to" / "Ship to" and the invoice details side by side, the item table,
totals on the right, and a footer with a thank-you line, support phone/email and links to the shipping/refund policy and
terms. Long names and addresses wrap; long invoices continue on new pages with the table header repeated and
"Page x of n" at the bottom.

Fonts: Noto Sans (SIL Open Font License, `src/server/invoices/assets/OFL.txt`), because the PDF standard fonts have no
₹ sign. The fonts and logo are copied into the server build by `outputFileTracingIncludes` in `next.config.ts`, and
`pdfkit` is listed in `serverExternalPackages`; both are checked against a real standalone build
(`scripts/standalone-invoice-smoke.mjs`), which is how Hostinger runs the app.

## Screens

- **Admin → Orders:** an *Invoice* column (number, links to the preview) and, per row, *View order*, *View invoice*
  and *Download invoice (PDF)*, with a "Preparing the invoice…" message and the error shown if it fails.
- **Admin → Orders → an order:** *View invoice* and *Invoice PDF* buttons (placed orders only).
- **Admin → Orders → an order → invoice:** on-screen preview laid out like the PDF, with *Open PDF* and *Download PDF*.
- **My account → an order:** *Download invoice* (placed orders only), also in the "Thank you, your order is placed" box.

## Deployment

Nothing to configure. On the next deploy the build applies `002_invoices.sql`; existing orders get their invoices the
first time Admin → Orders is opened. Optional: set the GSTIN in Admin → Settings, and `INVOICE_NUMBER_PREFIX` if a
prefix other than `INV` is wanted (set it before the first invoice; it only affects new numbers).

## Tests

- `scripts/invoice-smoke.mjs`: issuing on checkout, correct order, preview, PDF download/filename/A4, repeat =
  same invoice, several products, discount + shipping maths, address, GSTIN, access rules, unchanged after later edits,
  numbering without gaps or duplicates, cancelled orders, older orders, 6 simultaneous requests, a 45-line multi-page
  invoice (`SAVE_PDF_DIR=<folder>` keeps the PDFs).
- `scripts/razorpay-smoke.mjs`: no invoice while unpaid, exactly one once paid, none for a failed payment.
- `scripts/fresh-deploy-smoke.mjs`: first order on a new shop is INV-00001, PDF works from the production build,
  numbering continues across redeploys.
- `scripts/standalone-invoice-smoke.mjs`: standalone build (as on Hostinger) ships pdfkit, fonts and logo and serves a PDF.
