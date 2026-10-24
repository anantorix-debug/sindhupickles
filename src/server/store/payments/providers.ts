import "server-only";
import { randomUUID } from "node:crypto";
import { getSettings } from "@/server/repositories/settings";
import { razorpayConfig } from "@/server/store/payments/razorpay/config";
import type { PaymentProvider, PaymentProviderId } from "./types";

const cod: PaymentProvider = {
  id: "cod",
  dbName: "COD",
  label: "Cash on delivery",
  description: "Pay in cash when your order arrives.",
  // Not offered by the previous WordPress site (Razorpay only), so it is opt-in: the owner switches it on in Admin → Settings.
  isAvailable: async () => (await getSettings()).codEnabled,
  async initiate() {
    return {
      paymentStatus: "PENDING",
      orderStatus: "CONFIRMED",
      providerPaymentId: null,
      providerOrderId: null,
      instrument: null,
      events: [{ status: "CONFIRMED", message: "Order confirmed. Pay cash on delivery." }],
    };
  },
};

/** Development-only: records an instant "captured" payment with no real money movement. */
const mock: PaymentProvider = {
  id: "mock",
  dbName: "MOCK",
  label: "Test payment",
  description: "Development only — no money is charged.",
  isAvailable: () => process.env.NODE_ENV !== "production" || process.env.ENABLE_TEST_PAYMENTS === "true",
  async initiate() {
    return {
      paymentStatus: "CAPTURED",
      orderStatus: "CONFIRMED",
      providerPaymentId: `test_pay_${randomUUID()}`,
      providerOrderId: null,
      instrument: "test",
      events: [
        { status: "PAID", message: "TEST payment recorded (development mode — no funds moved)." },
        { status: "CONFIRMED", message: "Order confirmed and queued for the next fresh batch." },
      ],
    };
  },
};

/**
 * Online payment through Razorpay. Checkout only creates the (pending) order here; the Razorpay
 * order is created by /api/store/payments/razorpay/order and the payment is confirmed only by the
 * verified checkout callback and the signed webhook (see ./razorpay/*). It's offered only when
 * keys for the active mode are configured (and Live is explicitly approved).
 */
const razorpay: PaymentProvider = {
  id: "razorpay",
  dbName: "RAZORPAY",
  label: "Pay online (UPI, cards, netbanking)",
  description: "Secure online payment with Razorpay.",
  isAvailable: () => razorpayConfig() !== null,
  async initiate() {
    return { paymentStatus: "PENDING", orderStatus: "PENDING_PAYMENT", providerPaymentId: null, providerOrderId: null, instrument: null, events: [], clientAction: { type: "razorpay", payload: {} } };
  },
};

// Order matters: the checkout pre-selects the first available option, so online payment comes first.
const registry: Record<PaymentProviderId, PaymentProvider> = { razorpay, cod, mock };

export const getPaymentProvider = (id: PaymentProviderId) => registry[id];
export async function listAvailableProviders() {
  const providers = Object.values(registry);
  const flags = await Promise.all(providers.map((p) => p.isAvailable()));
  return providers.filter((_, i) => flags[i]);
}
