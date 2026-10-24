import { z } from "zod";

const name = z.string().trim().min(2, "Enter your full name").max(120, "Name is too long");
const email = z.email("Enter a valid email address").max(190).transform((v) => v.toLowerCase());
/** Indian mobile number: 10 digits starting 6-9, with an optional +91 / 0 prefix. */
const mobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use at least one letter and one number");

export const registerSchema = z
  .object({ name, email, phone: mobile, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });
export type RegisterFormValues = z.input<typeof registerSchema>;
export type RegisterInput = z.output<typeof registerSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password") });
export type LoginFormValues = z.input<typeof loginSchema>;
export type LoginInput = z.output<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.output<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ token: z.string().min(20, "This reset link is invalid"), password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });
export type ResetPasswordFormValues = z.input<typeof resetPasswordSchema>;
export type ResetPasswordInput = z.output<typeof resetPasswordSchema>;

export const profileSchema = z.object({ name, phone: mobile });
export type ProfileFormValues = z.input<typeof profileSchema>;
export type ProfileInput = z.output<typeof profileSchema>;

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });
export type ChangePasswordFormValues = z.input<typeof changePasswordSchema>;
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;

export const preferencesSchema = z.object({ orderUpdates: z.boolean(), offers: z.boolean() });

export const ADDRESS_TYPES = ["Home", "Work", "Other"] as const;

export const addressSchema = z.object({
  type: z.enum(ADDRESS_TYPES, { error: "Choose an address type" }),
  fullName: name,
  phone: mobile,
  line1: z.string().trim().min(3, "Enter the house / street address").max(255),
  line2: z.string().trim().max(255),
  area: z.string().trim().min(2, "Enter your area or locality").max(120),
  city: z.string().trim().min(2, "Enter your city").max(120),
  district: z.string().trim().min(2, "Enter your district").max(120),
  state: z.string().trim().min(2, "Select your state").max(120),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode"),
  landmark: z.string().trim().max(255),
  isDefault: z.boolean(),
});
export type AddressFormValues = z.input<typeof addressSchema>;
export type AddressInput = z.output<typeof addressSchema>;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
] as const;

export const cartItemSchema = z.object({
  variantId: z.string().regex(/^\d{1,18}$/),
  quantity: z.number().int().min(1).max(50),
});
export const cartItemsSchema = z.array(cartItemSchema).max(40);

export const cartValidateSchema = z.object({
  items: cartItemsSchema,
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
});

export const checkoutSchema = z
  .object({
    items: cartItemsSchema.min(1, "Your cart is empty"),
    /** Either an existing address of the signed-in customer, or a new one to save. */
    addressId: z.string().regex(/^\d{1,18}$/).optional(),
    newAddress: addressSchema.optional(),
    paymentMethod: z.enum(["cod", "mock", "razorpay"]),
    couponCode: z.string().trim().toUpperCase().max(40).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => Boolean(v.addressId) !== Boolean(v.newAddress), { path: ["addressId"], message: "Choose a delivery address" });
export type CheckoutInput = z.output<typeof checkoutSchema>;

export const enquirySchema = z.object({
  name,
  email,
  phone: z
    .string()
    .trim()
    .transform((v) => (v === "" ? "" : v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, "")))
    .refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number"),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000, "Please keep it under 2000 characters"),
  /** Honeypot: real visitors never see or fill this. */
  website: z.string().max(0).optional(),
});
export type EnquiryFormValues = z.input<typeof enquirySchema>;
export type EnquiryInput = z.output<typeof enquirySchema>;

/** A customer's review of a product they have received. */
export const reviewSchema = z.object({
  productSlug: z.string().trim().min(1).max(190),
  rating: z.number({ error: "Choose a star rating" }).int().min(1, "Choose a star rating").max(5, "Choose a star rating"),
  title: z.string().trim().max(100, "Keep the title under 100 characters").optional(),
  comment: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(1500, "Please keep it under 1500 characters"),
});
export type ReviewFormValues = z.input<typeof reviewSchema>;
export type ReviewInput = z.output<typeof reviewSchema>;
