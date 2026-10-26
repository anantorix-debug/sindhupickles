/**
 * Domain types shared by the REST API and the admin UI.
 * Money is expressed in rupees (the database stores paise; conversion happens
 * in `src/server/money.ts`). Enum-like values are lower-case; the database
 * stores them upper-case.
 */

export type ProductStatus = "active" | "draft" | "archived";
export type StockLevel = "in-stock" | "low" | "out";

export interface ProductVariant {
  id: string;
  sku: string;
  label: string;
  /** Variant price override; null means it uses the product price. */
  price: number | null;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  active: boolean;
  level: StockLevel;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  position: number;
}

export interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: string;
  categoryId: string;
  subcategory: string | null;
  subcategoryId: string | null;
  price: number;
  salePrice: number | null;
  status: ProductStatus;
  featured: boolean;
  ratingAvg: number;
  reviewCount: number;
  spiceLevel: number;
  shortDescription: string;
  description: string;
  images: ProductImage[];
  variants: ProductVariant[];
  totalStock: number;
  stockLevel: StockLevel;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | "pending_payment"
  | "payment_failed"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "return_requested"
  | "returned"
  | "refunded";

export type PaymentStatus = "captured" | "pending" | "failed" | "refunded" | "partially_refunded";
export type PaymentMethod = "mock" | "cod" | "razorpay";

export interface OrderSummary {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  placedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  variantLabel: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderEvent {
  id: string;
  type: string;
  status: OrderStatus | null;
  message: string;
  actor: string;
  at: string;
}

export interface Order extends OrderSummary {
  customerPhone: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shipping: number;
  shippingName: string;
  shippingAddress: string;
  tracking: { carrier: string; number: string } | null;
  customerNote: string | null;
  events: OrderEvent[];
}

export type CustomerStatus = "active" | "inactive" | "blocked";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string | null;
  state: string | null;
  status: CustomerStatus;
  ordersCount: number;
  totalSpent: number;
  joinedAt: string;
  lastOrderAt: string | null;
  notes: string | null;
}

export interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  refunded: number;
  instrument: string | null;
  providerPaymentId: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface InventoryItem {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  label: string;
  category: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  level: StockLevel;
  updatedAt: string;
}

export interface DashboardKpi {
  key: "revenue" | "orders" | "customers" | "aov";
  label: string;
  value: number;
  format: "currency" | "number";
  /** Change vs the previous 30 days; null when there is nothing to compare with. */
  changePct: number | null;
}

export interface RevenuePoint {
  label: string;
  revenue: number;
  orders: number;
}

export interface CategoryShare {
  category: string;
  revenue: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

export interface ActivityItem {
  id: string;
  message: string;
  at: string;
  kind: "order" | "customer" | "stock" | "payment";
}

export interface DashboardData {
  kpis: DashboardKpi[];
  revenueSeries: RevenuePoint[];
  categoryShare: CategoryShare[];
  topProducts: TopProduct[];
  recentOrders: OrderSummary[];
  activity: ActivityItem[];
}

export interface ReportsData {
  monthly: RevenuePoint[];
  categoryShare: CategoryShare[];
  topProducts: TopProduct[];
  paymentMix: { method: PaymentMethod; amount: number }[];
  totals: { revenue: number; orders: number; refunds: number; aov: number };
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  currency: string;
  freeShippingThreshold: number;
  shippingFee: number;
  welcomeCoupon: string;
  welcomeCouponPct: number;
  lowStockDefault: number;
  /** Offer cash on delivery at checkout. Switched on/off in Admin → Settings. */
  codEnabled: boolean;
  /** Forgot password page lets customers set a new password with just their email (no email check). Admin → Settings. */
  selfPasswordReset: boolean;
  notifyNewOrder: boolean;
  notifyLowStock: boolean;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Category {
  id: string;
  parentId: string | null;
  parentName: string | null;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  position: number;
  /** Picture shown on the storefront category tile (uploaded in Admin → Categories). */
  imageUrl: string | null;
  productCount: number;
}

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  area: string | null;
  district: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface Review {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  visible: boolean;
  /** "pending" = written by a customer and waiting for approval. */
  status: "pending" | "approved";
  createdAt: string;
}

export type BlogStatus = "draft" | "published";

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  category: string;
  authorName: string | null;
  featuredImage: string | null;
  status: BlogStatus;
  viewCount: number;
  readTime: number | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface BlogPost extends BlogPostSummary {
  content: string;
  excerpt: string;
  tags: string[];
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
}

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}
