import { ok } from "@/server/http";
import { getProfile } from "@/server/store/customer-auth";
import { storeRoute } from "@/server/store/http";
import { getSessionCustomerId } from "@/server/store/session";

/** The signed-in customer, or `null` for visitors (not an error — the header calls this on every page). */
export const GET = storeRoute(async () => {
  const id = await getSessionCustomerId();
  const profile = id ? await getProfile(id) : null;
  return ok(profile ? { id: profile.id, name: profile.name } : null, { headers: { "Cache-Control": "no-store" } });
});
