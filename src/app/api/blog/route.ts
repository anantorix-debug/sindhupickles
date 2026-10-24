import { blogPostSchema } from "@/lib/validation/content";
import { created, ok, readJson, adminRoute } from "@/server/http";
import { createPost, listPosts } from "@/server/repositories/blog";

export const GET = adminRoute(async () => ok(await listPosts()));

export const POST = adminRoute(async (req) => created(await createPost(await readJson(req, blogPostSchema))));
