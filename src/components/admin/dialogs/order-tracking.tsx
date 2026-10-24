"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Truck } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { FormField, fieldA11y } from "@/components/admin/forms/form-field";
import { FormError } from "@/components/admin/forms/form-feedback";
import { DEFAULT_CARRIER } from "@/lib/couriers";
import { trackingSchema, type TrackingInput } from "@/lib/validation/content";
import { updateOrderTracking } from "@/services/orders";

interface Props {
  orderId: string;
  orderNumber: string;
  tracking: { carrier: string; number: string } | null;
  disabled?: boolean;
}

export function OrderTrackingDialog({ orderId, orderNumber, tracking, disabled }: Props) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          <Truck className="size-4" aria-hidden /> {tracking ? "Edit tracking" : "Add tracking"}
        </Button>
      </DialogTrigger>
      <DialogContent>{open && <TrackingForm orderId={orderId} orderNumber={orderNumber} tracking={tracking} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function TrackingForm({ orderId, orderNumber, tracking, onDone }: Omit<Props, "disabled"> & { onDone: () => void }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TrackingInput>({
    resolver: zodResolver(trackingSchema),
    defaultValues: { carrier: tracking?.carrier ?? DEFAULT_CARRIER, number: tracking?.number ?? "" },
  });
  const mutation = useMutation({
    mutationFn: (v: TrackingInput) => updateOrderTracking(orderId, v),
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>Shipment tracking</DialogTitle>
        <DialogDescription>Order {orderNumber}</DialogDescription>
      </DialogHeader>
      <FormField label="Carrier" htmlFor="carrier" required error={errors.carrier?.message}>
        <Input {...fieldA11y("carrier", errors.carrier?.message)} placeholder={DEFAULT_CARRIER} {...register("carrier")} />
      </FormField>
      <FormField label="Tracking number (AWB)" htmlFor="number" required error={errors.number?.message} hint="Customers see this and a link to the courier's tracking page.">
        <Input {...fieldA11y("number", errors.number?.message)} placeholder="AWB number" autoFocus {...register("number")} />
      </FormField>
      {mutation.isError && <FormError>{mutation.error.message}</FormError>}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" loading={mutation.isPending}>Save tracking</Button>
      </DialogFooter>
    </form>
  );
}
