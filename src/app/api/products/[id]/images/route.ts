import { productImageSchema } from "@/lib/validation/content";
import { created, parseId, readJson, adminRoute } from "@/server/http";
import { addProductImage } from "@/server/repositories/products";

export const POST = adminRoute(async (req, { params }) => {
  const id = parseId((await params).id, "Product");
  const { url, alt } = await readJson(req, productImageSchema);
  return created(await addProductImage(id, url, alt));
});
