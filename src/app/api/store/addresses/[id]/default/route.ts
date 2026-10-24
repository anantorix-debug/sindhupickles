import { ok, parseId } from "@/server/http";
import { setDefaultAddress } from "@/server/store/addresses";
import { requireCustomer, storeRoute } from "@/server/store/http";

export const POST = storeRoute(async (_req, { params }) => {
  await setDefaultAddress(await requireCustomer(), parseId((await params).id, "Address"));
  return ok({ updated: true });
});
