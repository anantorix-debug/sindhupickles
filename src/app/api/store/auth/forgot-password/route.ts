import { forgotPasswordSchema } from "@/lib/validation/store";
import { ok, readJson } from "@/server/http";
import { requestPasswordReset } from "@/server/store/customer-auth";
import { storeRoute } from "@/server/store/http";
import { clientIp, rateLimit } from "@/server/store/rate-limit";

/** Same response whether or not the email is registered. */
export const POST = storeRoute(async (req) => {
  const { email } = await readJson(req, forgotPasswordSchema);
  rateLimit(`forgot:${clientIp(req)}`, 5, 60 * 60_000);
  rateLimit(`forgot-email:${email}`, 3, 60 * 60_000);
  await requestPasswordReset(email);
  return ok({ sent: true });
});
