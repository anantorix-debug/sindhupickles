import { productSchema } from "@/lib/validation/product";
import { notFound, ok, parseId, readJson, adminRoute } from "@/server/http";
import { deleteProduct, getProduct, updateProduct } from "@/server/repositories/products";

export const GET = adminRoute(async (_req, { params }) => {
  const product = await getProduct(parseId((await params).id, "Product"));
  if (!product) throw notFound("Product");
  return ok(product);
});

export const PUT = adminRoute(async (req, { params }) => {
  const id = parseId((await params).id, "Product");
  return ok(await updateProduct(id, await readJson(req, productSchema)));
});

export const DELETE = adminRoute(async (_req, { params }) => {
  await deleteProduct(parseId((await params).id, "Product"));
  return ok({ deleted: true });
});
