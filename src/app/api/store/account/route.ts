import { profileSchema } from "@/lib/validation/store";
import { notFound, ok, readJson } from "@/server/http";
import { getProfile, updateProfile } from "@/server/store/customer-auth";
import { requireCustomer, storeRoute } from "@/server/store/http";

export const GET = storeRoute(async () => {
  const profile = await getProfile(await requireCustomer());
  if (!profile) throw notFound("Account");
  return ok(profile, { headers: { "Cache-Control": "no-store" } });
});

export const PATCH = storeRoute(async (req) => {
  const id = await requireCustomer();
  await updateProfile(id, await readJson(req, profileSchema));
  return ok(await getProfile(id));
});
