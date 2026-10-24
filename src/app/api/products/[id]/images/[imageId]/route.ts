import { ok, parseId, adminRoute } from "@/server/http";
import { removeProductImage, setPrimaryImage } from "@/server/repositories/products";

/** Makes this image the product's main image. */
export const PATCH = adminRoute(async (_req, { params }) => {
  const p = await params;
  return ok(await setPrimaryImage(parseId(p.id, "Product"), parseId(p.imageId, "Image")));
});

export const DELETE = adminRoute(async (_req, { params }) => {
  const p = await params;
  return ok(await removeProductImage(parseId(p.id, "Product"), parseId(p.imageId, "Image")));
});
