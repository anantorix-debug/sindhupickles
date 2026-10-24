# Razorpay integration

## Flow

1. Checkout (`POST /api/store/checkout`) creates an unpaid **draft** (`PENDING_PAYMENT`), reserves stock and computes the total **on the server**. A draft is not an order yet: it is hidden from "My orders", Admin lists, the dashboard and customer counts, no email is sent, and the customer's cart is kept. It becomes a real, confirmed order only when payment is verified. If the customer closes the payment window or the payment fails, they stay on checkout and can retry (the same draft is reused); unpaid drafts are cancelled and their stock released by the sweeper.
2. `POST /api/store/payments/razorpay/order` creates (or re-uses) a Razorpay order for exactly that server-computed amount. Receipt = our order number.
3. The browser opens Razorpay Checkout (`src/components/store/checkout/razorpay-client.ts`).
4. On success the browser calls `POST /api/store/payments/razorpay/verify`. The server checks the HMAC signature (`order_id|payment_id`), then asks Razorpay's API for the payment and compares status and amount. "Paid" only ever means the server verified it.
5. The signed webhook (`/api/store/payments/razorpay/webhook`) is the second, independent confirmation path (covers closed browser tabs).
6. A sweeper (`POST /api/store/payments/expire`, protected by `CRON_SECRET`) cancels stale unpaid orders and releases stock.

## Safety properties (all covered by `scripts/razorpay-smoke.mjs`, 42 checks)

- Amount is never taken from the client; mismatches are not confirmed.
- Invalid / cross-payment / wrong-order signatures are rejected.
- Webhook: raw-body HMAC, wrong/missing/tampered signature → 401; duplicate events are a no-op (`webhook_events` unique on provider + event id).
- A late failure event cannot undo a confirmed payment; a late payment on a cancelled order is flagged for review, not silently confirmed.
- Partial and full refunds are recorded.
- Other customers cannot start or verify your order (404); signed-out → 401.
- The key secret never appears in API responses or the client bundle.

## Configuration

Secrets live only in `.env.local` / the host's environment (never in git, logs or frontend). See `.env.example`.

- `RAZORPAY_MODE=test|live` chooses which key set is read.
- Test: `RAZORPAY_TEST_KEY_ID` (`rzp_test_…`), `RAZORPAY_TEST_KEY_SECRET`, `RAZORPAY_TEST_WEBHOOK_SECRET`.
- Live: `RAZORPAY_LIVE_KEY_ID` (`rzp_live_…`), `RAZORPAY_LIVE_KEY_SECRET`, `RAZORPAY_LIVE_WEBHOOK_SECRET`, **and** `RAZORPAY_LIVE_APPROVED=true`. Without the approval flag live mode refuses to start. Key-id prefix must match the mode.
- "Pay online" is shown only when the active mode has complete keys. The dev-only "Test payment" is hidden at checkout whenever Razorpay is configured.

## Webhook setup

URL `https://<domain>/api/store/payments/razorpay/webhook`; events `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`. For local testing, expose the dev server with a Cloudflare quick tunnel and use its URL.

## Running the tests

```
# mock Razorpay (no keys, no money): start the server with the mock env described at the top of scripts/razorpay-smoke.mjs
BASE=http://localhost:3112 node scripts/razorpay-smoke.mjs
# real Razorpay TEST API contract check (creates one unpaid Test order, charges nothing)
node scripts/razorpay-testmode-check.mjs
```

## Status (honest)

- Verified: mock-gateway suite passes (42/42) on the production build; real Test-API contract check passes (keys accepted, order created in INR with the right amount and receipt, forged confirmation rejected, forged webhook rejected).
- **Not yet verified:** a real Test-mode payment completed in the Razorpay window, and a real webhook delivery reaching `webhook_events`. Do one card payment (`4111 1111 1111 1111`) to close this.
- **Live mode:** untested by design. Needs KYC-approved Live keys, owner approval, then one small real order + refund.
