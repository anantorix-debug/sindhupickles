import {
  customerStatusMeta,
  metaOf,
  orderStatusMeta,
  paymentStatusMeta,
  productStatusMeta,
  stockLevelMeta,
  type Tone,
} from "@/config/labels";
import type { CustomerStatus, OrderStatus, PaymentStatus, ProductStatus, StockLevel } from "@/types";
import { cn } from "@/lib/utils";

const toneClasses: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  primary: "bg-accent-soft text-accent",
  neutral: "bg-surface-raised text-muted",
};

export function StatusBadge({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => <StatusBadge {...metaOf(orderStatusMeta, status)} />;
export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => <StatusBadge {...metaOf(paymentStatusMeta, status)} />;
export const ProductStatusBadge = ({ status }: { status: ProductStatus }) => <StatusBadge {...metaOf(productStatusMeta, status)} />;
export const StockBadge = ({ level }: { level: StockLevel }) => <StatusBadge {...metaOf(stockLevelMeta, level)} />;
export const CustomerStatusBadge = ({ status }: { status: CustomerStatus }) => <StatusBadge {...metaOf(customerStatusMeta, status)} />;
