import { preferencesSchema } from "@/lib/validation/store";
import { ok, readJson } from "@/server/http";
import { getProfile, updatePreferences } from "@/server/store/customer-auth";
import { requireCustomer, storeRoute } from "@/server/store/http";

export const PATCH = storeRoute(async (req) => {
  const id = await requireCustomer();
  await updatePreferences(id, await readJson(req, preferencesSchema));
  return ok((await getProfile(id))?.preferences);
});
