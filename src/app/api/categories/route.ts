import { categorySchema } from "@/lib/validation/content";
import { created, ok, readJson, adminRoute } from "@/server/http";
import { createCategory, listCategories } from "@/server/repositories/categories";

export const GET = adminRoute(async () => ok(await listCategories()));

export const POST = adminRoute(async (req) => created(await createCategory(await readJson(req, categorySchema))));
