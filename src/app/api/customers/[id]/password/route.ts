import { adminSetPasswordSchema } from "@/lib/validation/store";
import { adminRoute, ok, parseId, readJson } from "@/server/http";
import { adminSetPassword } from "@/server/store/customer-auth";

/** Admin -> Customers -> "Set new password": for a customer who contacted the shop because they forgot theirs. */
export const PUT = adminRoute(async (req, { params }) => {
  const id = parseId((await params).id, "Customer");
  const { password } = await readJson(req, adminSetPasswordSchema);
  await adminSetPassword(id, password);
  return ok({ updated: true });
});
