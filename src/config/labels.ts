import type {
  CustomerStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  StockLevel,
} from "@/types";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";
export interface Meta {
  label: string;
  tone: Tone;
}

export const productStatusMeta: Record<ProductStatus, Meta> = {
  active: { label: "Active", tone: "success" },
  draft: { label: "Draft", tone: "warning" },
  archived: { label: "Archived", tone: "neutral" },
};

export const orderStatusMeta: Record<OrderStatus, Meta> = {
  pending_payment: { label: "Awaiting payment", tone: "warning" },
  payment_failed: { label: "Payment failed", tone: "danger" },
  confirmed: { label: "Confirmed", tone: "info" },
  processing: { label: "Processing", tone: "info" },
  packed: { label: "Packed", tone: "primary" },
  shipped: { label: "Shipped", tone: "primary" },
  out_for_delivery: { label: "Out for delivery", tone: "primary" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  return_requested: { label: "Return requested", tone: "warning" },
  returned: { label: "Returned", tone: "neutral" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export const paymentStatusMeta: Record<PaymentStatus, Meta> = {
  captured: { label: "Paid", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
  partially_refunded: { label: "Part refunded", tone: "neutral" },
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  mock: "Test payment",
  cod: "Cash on delivery",
  razorpay: "Razorpay",
};

export const stockLevelMeta: Record<StockLevel, Meta> = {
  "in-stock": { label: "In stock", tone: "success" },
  low: { label: "Low stock", tone: "warning" },
  out: { label: "Out of stock", tone: "danger" },
};

export const customerStatusMeta: Record<CustomerStatus, Meta> = {
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  blocked: { label: "Blocked", tone: "danger" },
};

/** Look up display meta, tolerating values the UI doesn't know about yet. */
export const metaOf = <K extends string>(map: Record<K, Meta>, key: string): Meta =>
  (map as Record<string, Meta>)[key] ?? { label: key.replace(/_/g, " "), tone: "neutral" };

export const methodLabel = (method: string) =>
  (paymentMethodLabels as Record<string, string>)[method] ?? method.toUpperCase();

export const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export const toMetaOptions = <T extends string>(meta: Record<T, { label: string }>) =>
  (Object.keys(meta) as T[]).map((value) => ({ value, label: meta[value].label }));
