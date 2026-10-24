import { Check } from "lucide-react";
import { metaOf, orderStatusMeta } from "@/config/labels";
import { FULFILMENT_FLOW } from "@/lib/order-flow";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

const STEPS = FULFILMENT_FLOW.filter((s) => s !== "pending_payment");

/** Progress through fulfilment. Off-path states (cancelled, returns) are shown as a message instead. */
export function OrderTracker({ status }: { status: OrderStatus }) {
  if (status === "cancelled" || status === "payment_failed" || status === "return_requested" || status === "returned" || status === "refunded" || status === "pending_payment") {
    const meta = metaOf(orderStatusMeta, status);
    const text: Partial<Record<OrderStatus, string>> = {
      pending_payment: "We're waiting for your payment to be confirmed.",
      payment_failed: "The payment didn't go through, so this order wasn't placed.",
      cancelled: "This order was cancelled.",
      return_requested: "Your return request has been received and is being reviewed.",
      returned: "This order has been returned.",
      refunded: "This order has been refunded.",
    };
    return (
      <p className="rounded-md bg-surface-raised px-4 py-3 text-sm">
        <span className="font-semibold">{meta.label}.</span> <span className="text-muted">{text[status]}</span>
      </p>
    );
  }

  const current = Math.max(STEPS.indexOf(status), 0);
  return (
    <ol className="grid grid-cols-3 gap-y-5 sm:grid-cols-6" aria-label="Order progress">
      {STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step} className="flex flex-col items-center gap-2 text-center" aria-current={i === current ? "step" : undefined}>
            <span className={cn("flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold", done ? "border-primary bg-primary text-white" : "border-border text-muted")}>
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cn("text-xs", done ? "font-semibold text-foreground" : "text-muted")}>{orderStatusMeta[step].label}</span>
          </li>
        );
      })}
    </ol>
  );
}
