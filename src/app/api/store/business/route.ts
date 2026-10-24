import { ok } from "@/server/http";
import { getPublicBusiness } from "@/server/store/catalog";
import { storeRoute } from "@/server/store/http";

/** Public business info (name, contact, shipping rules) — edited in Admin → Settings. */
export const GET = storeRoute(async () => ok(await getPublicBusiness(), { headers: { "Cache-Control": "public, s-maxage=60" } }));
