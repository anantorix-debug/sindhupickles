import { addressSchema } from "@/lib/validation/store";
import { created, ok, readJson } from "@/server/http";
import { createAddress, listAddresses } from "@/server/store/addresses";
import { requireCustomer, storeRoute } from "@/server/store/http";

export const GET = storeRoute(async () => ok(await listAddresses(await requireCustomer()), { headers: { "Cache-Control": "no-store" } }));

export const POST = storeRoute(async (req) => {
  const id = await requireCustomer();
  return created(await createAddress(id, await readJson(req, addressSchema)));
});
