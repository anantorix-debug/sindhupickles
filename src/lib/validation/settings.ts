import { z } from "zod";

const money = (label: string) =>
  z.number({ error: `${label} is required` }).int(`${label} must be a whole number`).min(0, `${label} cannot be negative`);

/** Optional https link shown in the storefront footer. */
const socialUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Use a full https:// link, or leave empty");

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2, "Store name is required"),
  tagline: z.string().trim().max(60, "Keep the tagline under 60 characters"),
  supportEmail: z.email("Enter a valid email address"),
  supportPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,18}$/, "Enter a valid phone number"),
  address: z.string().trim().min(10, "Enter the full store address"),
  currency: z.string().length(3),
  freeShippingThreshold: money("Free-shipping threshold"),
  shippingFee: money("Shipping fee"),
  welcomeCoupon: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{0,20}$/, "Use letters and numbers only"),
  welcomeCouponPct: z.number({ error: "Discount is required" }).min(0, "Min 0%").max(100, "Max 100%"),
  lowStockDefault: money("Low-stock default"),
  codEnabled: z.boolean(),
  selfPasswordReset: z.boolean(),
  notifyNewOrder: z.boolean(),
  notifyLowStock: z.boolean(),
  instagramUrl: socialUrl,
  facebookUrl: socialUrl,
  youtubeUrl: socialUrl,
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
