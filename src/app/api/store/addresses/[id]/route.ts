import { addressSchema } from "@/lib/validation/store";
import { ok, parseId, readJson } from "@/server/http";
import { deleteAddress, updateAddress } from "@/server/store/addresses";
import { requireCustomer, storeRoute } from "@/server/store/http";

export const PUT = storeRoute(async (req, { params }) => {
  const customerId = await requireCustomer();
  return ok(await updateAddress(customerId, parseId((await params).id, "Address"), await readJson(req, addressSchema)));
});

export const DELETE = storeRoute(async (_req, { params }) => {
  await deleteAddress(await requireCustomer(), parseId((await params).id, "Address"));
  return ok({ deleted: true });
});
