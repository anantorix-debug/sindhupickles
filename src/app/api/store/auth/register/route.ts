import { registerSchema } from "@/lib/validation/store";
import { created, readJson } from "@/server/http";
import { register } from "@/server/store/customer-auth";
import { storeRoute } from "@/server/store/http";
import { clientIp, rateLimit } from "@/server/store/rate-limit";
import { startSession } from "@/server/store/session";

export const POST = storeRoute(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
  const id = await register(await readJson(req, registerSchema));
  await startSession(id);
  return created({ id });
});
