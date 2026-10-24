import { settingsSchema } from "@/lib/validation/settings";
import { ok, readJson, adminRoute } from "@/server/http";
import { getSettings, updateSettings } from "@/server/repositories/settings";

export const GET = adminRoute(async () => ok(await getSettings()));

export const PUT = adminRoute(async (req) => ok(await updateSettings(await readJson(req, settingsSchema))));
