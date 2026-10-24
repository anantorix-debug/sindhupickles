import { loginSchema } from "@/lib/validation/store";
import { ok, readJson } from "@/server/http";
import { login } from "@/server/store/customer-auth";
import { storeRoute } from "@/server/store/http";
import { clientIp, rateLimit } from "@/server/store/rate-limit";
import { startSession } from "@/server/store/session";

export const POST = storeRoute(async (req) => {
  const { email, password } = await readJson(req, loginSchema);
  rateLimit(`login:${clientIp(req)}:${email}`, 8, 15 * 60_000);
  const id = await login(email, password);
  await startSession(id);
  return ok({ id });
});
