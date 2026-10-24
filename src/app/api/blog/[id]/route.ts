import { blogPostSchema } from "@/lib/validation/content";
import { notFound, ok, parseId, readJson, adminRoute } from "@/server/http";
import { deletePost, getPost, updatePost } from "@/server/repositories/blog";

export const GET = adminRoute(async (_req, { params }) => {
  const post = await getPost(parseId((await params).id, "Post"));
  if (!post) throw notFound("Post");
  return ok(post);
});

export const PUT = adminRoute(async (req, { params }) => {
  const id = parseId((await params).id, "Post");
  return ok(await updatePost(id, await readJson(req, blogPostSchema)));
});

export const DELETE = adminRoute(async (_req, { params }) => {
  await deletePost(parseId((await params).id, "Post"));
  return ok({ deleted: true });
});
