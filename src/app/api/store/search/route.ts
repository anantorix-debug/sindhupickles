import { ok } from "@/server/http";
import { searchSuggestions } from "@/server/store/catalog";
import { storeRoute } from "@/server/store/http";

/** Quick suggestions for the header search box. */
export const GET = storeRoute(async (req) => ok(await searchSuggestions(req.nextUrl.searchParams.get("q") ?? "")));
