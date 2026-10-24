/** Types used by the public storefront. Money is in rupees, like the admin types. */
import type { StockLevel } from "@/types";

export interface StoreCategory {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  productCount: number;
}

export interface StoreVariant {
  id: string;
  sku: string;
  label: string;
  /** Selling price (sale price applied). */
  price: number;
  /** Original price when the item is on sale, otherwise null. */
  compareAtPrice: number | null;
  available: number;
  inStock: boolean;
}

export interface StoreProductCard {
  id: string;
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  imageUrl: string | null;
  /** Selling price of the default pack (the one "Add to cart" adds). */
  price: number;
  compareAtPrice: number | null;
  hasMultiplePacks: boolean;
  firstVariantId: string | null;
  firstVariantLabel: string | null;
  inStock: boolean;
  lowStock: boolean;
  featured: boolean;
  ratingAvg: number;
  reviewCount: number;
  shortDescription: string;
}

export interface StoreReview {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: string;
}

export interface StoreProductDetail extends StoreProductCard {
  sku: string;
  description: string;
  spiceLevel: number;
  metaTitle: string | null;
  metaDescription: string | null;
  subcategory: string | null;
  images: { url: string; alt: string }[];
  variants: StoreVariant[];
  stockLevel: StockLevel;
  related: StoreProductCard[];
  reviews: StoreReview[];
  updatedAt: string;
}

export type ProductSort = "featured" | "newest" | "price-asc" | "price-desc" | "rating" | "name";

export interface ProductListResult {
  items: StoreProductCard[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export type CartIssue = "unavailable" | "out_of_stock" | "reduced" | "price_changed";

export interface PricedCartLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  /** Quantity after clamping to what's actually available. */
  quantity: number;
  requestedQuantity: number;
  available: number;
  lineTotal: number;
  issue: CartIssue | null;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode: string | null;
  couponError: string | null;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
}

export interface PricedCart {
  lines: PricedCartLine[];
  totals: CartTotals;
}

export interface CartItemInput {
  variantId: string;
  quantity: number;
}

export interface CustomerPreferences {
  orderUpdates: boolean;
  offers: boolean;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  preferences: CustomerPreferences;
}

export interface PaymentOption {
  id: "cod" | "mock" | "razorpay";
  label: string;
  description: string;
}

export interface PublicBusiness {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  freeShippingThreshold: number;
  shippingFee: number;
  welcomeCoupon: string;
  welcomeCouponPct: number;
}
