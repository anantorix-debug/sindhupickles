"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-feedback";
import { payOrder } from "@/components/store/checkout/razorpay-client";

/** Lets a customer finish (or retry) paying for an unpaid online order. */
export function PayNow({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const { result, message } = await payOrder(orderId);
      if (result === "failed") setError(message ?? "The payment didn't go through. You can try again.");
      router.push(`/account/orders/${orderId}?${result === "paid" ? "placed=1" : `payment=${result}`}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the payment. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={pay} loading={busy}>
        <CreditCard className="size-4" aria-hidden /> Pay now
      </Button>
      {error && <FormError>{error}</FormError>}
    </div>
  );
}
