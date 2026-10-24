"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField, fieldA11y } from "@/components/admin/forms/form-field";
import { FormError } from "@/components/admin/forms/form-feedback";
import { stockAdjustSchema, type StockAdjustInput } from "@/lib/validation/api";
import { adjustStock } from "@/services/inventory";
import { ApiRequestError } from "@/services/api-client";
import type { InventoryItem } from "@/types";

interface AdjustStockDialogProps {
  item: InventoryItem | null;
  onOpenChange: (open: boolean) => void;
}

export function AdjustStockDialog({ item, onOpenChange }: AdjustStockDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent>{item && <AdjustStockForm key={item.variantId} item={item} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function AdjustStockForm({ item, onDone }: { item: InventoryItem; onDone: () => void }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StockAdjustInput>({ resolver: zodResolver(stockAdjustSchema), defaultValues: { onHand: item.onHand, reason: "" } });

  const mutation = useMutation({
    mutationFn: (v: StockAdjustInput) => adjustStock(item.variantId, v),
    onSuccess: () => {
      onDone();
      router.refresh();
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.fields?.onHand) setError("onHand", { message: err.fields.onHand });
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>Adjust stock</DialogTitle>
        <DialogDescription>
          {item.productName} · {item.label} — {item.reserved} reserved by open orders
        </DialogDescription>
      </DialogHeader>
      <FormField label="Units on hand" htmlFor="onHand" required error={errors.onHand?.message}>
        <Input {...fieldA11y("onHand", errors.onHand?.message)} type="number" inputMode="numeric" min={0} autoFocus {...register("onHand", { valueAsNumber: true })} />
      </FormField>
      <FormField label="Reason" htmlFor="reason" hint="Recorded in the stock history." error={errors.reason?.message}>
        <Input {...fieldA11y("reason", errors.reason?.message, true)} placeholder="e.g. New batch received" {...register("reason")} />
      </FormField>
      {mutation.isError && <FormError>{mutation.error.message}</FormError>}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" loading={mutation.isPending}>Save</Button>
      </DialogFooter>
    </form>
  );
}
