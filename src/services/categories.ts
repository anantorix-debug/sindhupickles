import type { CategoryInput } from "@/lib/validation/content";
import type { Category } from "@/types";
import { api } from "./api-client";

export const createCategory = (input: CategoryInput) => api<Category>("/categories", { method: "POST", body: input });
export const updateCategory = (id: string, input: CategoryInput) => api<Category>(`/categories/${id}`, { method: "PUT", body: input });
export const deleteCategory = (id: string) => api<{ deleted: true }>(`/categories/${id}`, { method: "DELETE" });
