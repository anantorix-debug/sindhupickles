import "server-only";

export type RazorpayMode = "test" | "live";

export interface RazorpayConfig {
  mode: RazorpayMode;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  apiBase: string;
}

/**
 * Credentials come only from the environment (never the repo). Test and Live have separate keys
 * and separate webhook secrets. Live mode additionally requires RAZORPAY_LIVE_APPROVED=true, so
 * merely having live keys present can never switch real payments on.
 */
export function razorpayConfig(): RazorpayConfig | null {
  const mode: RazorpayMode = process.env.RAZORPAY_MODE === "live" ? "live" : "test";
  const p = mode === "live" ? "RAZORPAY_LIVE" : "RAZORPAY_TEST";
  const keyId = process.env[`${p}_KEY_ID`];
  const keySecret = process.env[`${p}_KEY_SECRET`];
  if (!keyId || !keySecret) return null;
  if (mode === "live" && process.env.RAZORPAY_LIVE_APPROVED !== "true") return null;
  if (mode === "test" && !keyId.startsWith("rzp_test_") && !process.env.RAZORPAY_API_BASE) return null; // guard against a live key in test mode
  if (mode === "live" && !keyId.startsWith("rzp_live_")) return null;
  return {
    mode,
    keyId,
    keySecret,
    webhookSecret: process.env[`${p}_WEBHOOK_SECRET`] ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
    // Overridable only so automated tests can point at a local mock; never needed in real deployments.
    apiBase: process.env.RAZORPAY_API_BASE ?? "https://api.razorpay.com/v1",
  };
}
