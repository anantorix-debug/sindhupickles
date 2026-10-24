import { z } from "zod";

const optionalId = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v)) ? null : v),
  z.number().int().positive().nullable(),
);

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(160, "Name is too long"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(190)
    .regex(/^[a-z0-9]*(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
    .optional(),
  description: z.string().trim().max(2000, "Keep it under 2000 characters"),
  parentId: optionalId,
  active: z.boolean(),
});
export type CategoryFormValues = z.input<typeof categorySchema>;
export type CategoryInput = z.output<typeof categorySchema>;

export const BLOG_STATUSES = ["draft", "published"] as const;

export const blogPostSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200, "Title is too long"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(190)
    .regex(/^[a-z0-9]*(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
    .optional(),
  category: z.string().trim().min(2, "Category is required").max(80),
  authorName: z.string().trim().max(120),
  excerpt: z.string().trim().max(500, "Keep the excerpt under 500 characters"),
  content: z.string().trim().min(20, "Write at least a few sentences"),
  featuredImage: z.string().trim().max(500),
  /** Comma separated in the form; array over the API. */
  tags: z.union([z.string(), z.array(z.string())]).transform((v) =>
    (Array.isArray(v) ? v : v.split(","))
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12),
  ),
  status: z.enum(BLOG_STATUSES),
  metaTitle: z.string().trim().max(200),
  metaDescription: z.string().trim().max(500),
  focusKeyword: z.string().trim().max(120),
});
export type BlogFormValues = z.input<typeof blogPostSchema>;
export type BlogPostInput = z.output<typeof blogPostSchema>;

export const reviewVisibilitySchema = z.object({ visible: z.boolean() });
export const enquiryReadSchema = z.object({ isRead: z.boolean() });

export const trackingSchema = z.object({
  carrier: z.string().trim().min(2, "Carrier is required").max(120),
  number: z.string().trim().min(3, "Tracking number is required").max(120),
});
export type TrackingInput = z.infer<typeof trackingSchema>;

export const productImageSchema = z.object({
  url: z
    .string()
    .trim()
    .max(500)
    .refine((u) => u.startsWith("/uploads/") || /^https:\/\//.test(u), "Use an uploaded image or an https URL"),
  alt: z.string().trim().max(255),
});
