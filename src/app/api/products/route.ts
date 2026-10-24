import { productSchema } from "@/lib/validation/product";
import { created, ok, readJson, adminRoute } from "@/server/http";
import { createProduct, listProducts } from "@/server/repositories/products";

export const GET = adminRoute(async () => ok(await listProducts()));

export const POST = adminRoute(async (req) => created(await createProduct(await readJson(req, productSchema))));
