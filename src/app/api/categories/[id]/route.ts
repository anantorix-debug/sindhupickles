import { categorySchema } from "@/lib/validation/content";
import { notFound, ok, parseId, readJson, adminRoute } from "@/server/http";
import { deleteCategory, getCategory, updateCategory } from "@/server/repositories/categories";

export const GET = adminRoute(async (_req, { params }) => {
  const category = await getCategory(parseId((await params).id, "Category"));
  if (!category) throw notFound("Category");
  return ok(category);
});

export const PUT = adminRoute(async (req, { params }) => {
  const id = parseId((await params).id, "Category");
  return ok(await updateCategory(id, await readJson(req, categorySchema)));
});

export const DELETE = adminRoute(async (_req, { params }) => {
  await deleteCategory(parseId((await params).id, "Category"));
  return ok({ deleted: true });
});
