import type { BlogPostInput } from "@/lib/validation/content";
import type { BlogPost } from "@/types";
import { api } from "./api-client";

export const createPost = (input: BlogPostInput) => api<BlogPost>("/blog", { method: "POST", body: input });
export const updatePost = (id: string, input: BlogPostInput) => api<BlogPost>(`/blog/${id}`, { method: "PUT", body: input });
export const deletePost = (id: string) => api(`/blog/${id}`, { method: "DELETE" });
