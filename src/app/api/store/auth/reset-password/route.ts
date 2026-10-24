import { resetPasswordSchema } from "@/lib/validation/store";
import { ok, readJson } from "@/server/http";
import { resetPassword } from "@/server/store/customer-auth";
import { storeRoute } from "@/server/store/http";
import { clientIp, rateLimit } from "@/server/store/rate-limit";

export const POST = storeRoute(async (req) => {
  rateLimit(`reset:${clientIp(req)}`, 10, 60 * 60_000);
  await resetPassword(await readJson(req, resetPasswordSchema));
  return ok({ reset: true });
});
