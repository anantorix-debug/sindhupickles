import { changePasswordSchema } from "@/lib/validation/store";
import { ok, readJson } from "@/server/http";
import { changePassword } from "@/server/store/customer-auth";
import { requireCustomer, storeRoute } from "@/server/store/http";
import { rateLimit } from "@/server/store/rate-limit";

export const POST = storeRoute(async (req) => {
  const id = await requireCustomer();
  rateLimit(`password:${id}`, 5, 15 * 60_000);
  await changePassword(id, await readJson(req, changePasswordSchema));
  return ok({ changed: true });
});
