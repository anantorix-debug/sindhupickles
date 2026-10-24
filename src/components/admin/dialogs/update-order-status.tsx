"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { FormField } from "@/components/admin/forms/form-field";
import { FormError } from "@/components/admin/forms/form-feedback";
import { metaOf, orderStatusMeta } from "@/config/labels";
import { allowedNextStatuses } from "@/lib/order-flow";
import { updateOrderStatus } from "@/services/orders";
import type { OrderStatus } from "@/types";

interface Props {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
}

export function UpdateOrderStatusDialog({ orderId, orderNumber, status }: Props) {
  const router = useRouter();
  const options = allowedNextStatuses(status);
  const [open, setOpen] = React.useState(false);
  const [next, setNext] = React.useState<OrderStatus>(options[0] ?? status);

  const mutation = useMutation({
    mutationFn: () => updateOrderStatus(orderId, next),
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  if (options.length === 0) {
    return (
      <Button variant="secondary" disabled title="This order's status can no longer be changed">
        <Lock className="size-4" aria-hidden /> Status locked
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setNext(options[0]);
          mutation.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary">
          <RefreshCw className="size-4" aria-hidden /> Update status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update order status</DialogTitle>
          <DialogDescription>
            Order {orderNumber} is currently <strong>{metaOf(orderStatusMeta, status).label}</strong>. Orders only move forward.
          </DialogDescription>
        </DialogHeader>
        <FormField label="New status" htmlFor="order-status">
          <Select id="order-status" value={next} onChange={(e) => setNext(e.target.value as OrderStatus)}>
            {options.map((value) => (
              <option key={value} value={value}>
                {metaOf(orderStatusMeta, value).label}
              </option>
            ))}
          </Select>
        </FormField>
        {next === "shipped" && <p className="mt-3 text-xs text-muted">Shipping deducts the reserved units from stock.</p>}
        {next === "cancelled" && <p className="mt-3 text-xs text-muted">Cancelling releases any reserved stock. A cancelled order can&apos;t be changed again.</p>}
        {mutation.isError && (
          <div className="mt-4">
            <FormError>{mutation.error.message}</FormError>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant={next === "cancelled" ? "danger" : "primary"} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
