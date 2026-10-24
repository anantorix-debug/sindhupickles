import { z } from "zod";

export const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;

/** Empty inputs arrive as NaN/"" — normalise them to null before validating. */
const optionalPrice = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v)) ? null : v),
  z.number({ error: "Enter a valid amount" }).positive("Must be greater than 0").nullable(),
);

/** Shared by the product form and the REST API. Prices are in rupees. */
export const productSchema = z
  .object({
    name: z.string().trim().min(3, "Name must be at least 3 characters").max(200, "Name is too long"),
    sku: z
      .string()
      .trim()
      .min(1, "SKU is required")
      .max(64, "SKU is too long")
      .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and dashes only"),
    categoryId: z.number({ error: "Choose a category" }).int().positive("Choose a category"),
    subcategoryId: z.preprocess(
      (v) => (v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v)) ? null : v),
      z.number().int().positive().nullable(),
    ),
    price: z.number({ error: "Price is required" }).positive("Price must be greater than 0").max(100000, "That price looks too high"),
    salePrice: optionalPrice,
    status: z.enum(PRODUCT_STATUSES),
    featured: z.boolean(),
    spiceLevel: z.number({ error: "Spice level is required" }).int("Whole number").min(0, "Min 0").max(5, "Max 5"),
    shortDescription: z.string().trim().max(500, "Keep it under 500 characters"),
    description: z.string().trim().min(10, "Describe the product in at least 10 characters").max(5000, "Description is too long"),
  })
  .refine((v) => v.salePrice === null || v.salePrice < v.price, {
    path: ["salePrice"],
    message: "Sale price must be lower than the price",
  });

export type ProductFormValues = z.input<typeof productSchema>;
export type ProductInput = z.output<typeof productSchema>;
