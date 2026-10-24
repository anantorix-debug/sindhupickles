import type { ProductInput } from "@/lib/validation/product";
import type { Product } from "@/types";
import { api } from "./api-client";

export const createProduct = (input: ProductInput) => api<Product>("/products", { method: "POST", body: input });

export const updateProduct = (id: string, input: ProductInput) => api<Product>(`/products/${id}`, { method: "PUT", body: input });

export const deleteProduct = (id: string) => api<{ deleted: true }>(`/products/${id}`, { method: "DELETE" });

export const addProductImage = (id: string, url: string, alt: string) =>
  api<Product>(`/products/${id}/images`, { method: "POST", body: { url, alt } });
export const removeProductImage = (id: string, imageId: string) =>
  api<Product>(`/products/${id}/images/${imageId}`, { method: "DELETE" });
export const setPrimaryProductImage = (id: string, imageId: string) =>
  api<Product>(`/products/${id}/images/${imageId}`, { method: "PATCH" });
