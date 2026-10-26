import { directResetSchema } from "@/lib/validation/store";
import { ApiError, ok, readJson } from "@/server/http";
import { getSettings } from "@/server/repositories/settings";
import { directResetPassword } from "@/server/store/customer-auth";
import { storeRoute } from "@/server/store/http";
import { clientIp, rateLimit } from "@/server/store/rate-limit";

/** Forgot password without email: email + new password. Only while Admin -> Settings -> "Reset password without email check" is on. */
export const POST = storeRoute(async (req) => {
  const { email, password } = await readJson(req, directResetSchema);
  if (!(await getSettings()).selfPasswordReset) throw new ApiError(403, "Please contact us to reset your password.", "reset_disabled");
  const ip = clientIp(req);
  rateLimit(`set-password:${ip}`, 5, 60 * 60_000);
  rateLimit(`set-password-email:${email}`, 3, 60 * 60_000);
  await directResetPassword(email, password);
  console.info("[auth] customer password changed from the forgot-password page", { email, ip });
  return ok({ updated: true });
});
