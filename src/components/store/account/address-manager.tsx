"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui/status-badge";
import { FormError } from "@/components/ui/form-feedback";
import { StateMessage } from "@/components/store/common/state-message";
import { AddressFields, emptyAddress } from "@/components/store/forms/address-fields";
import { addressSchema, type AddressFormValues, type AddressInput } from "@/lib/validation/store";
import { ApiRequestError } from "@/services/api-client";
import { storeApi } from "@/services/store";
import type { Address } from "@/types";

export const addressToForm = (a: Address): AddressFormValues => ({
  type: (["Home", "Work", "Other"].includes(a.label) ? a.label : "Other") as AddressFormValues["type"],
  fullName: a.fullName,
  phone: a.phone,
  line1: a.line1,
  line2: a.line2 ?? "",
  area: a.area ?? "",
  city: a.city,
  district: a.district ?? "",
  state: a.state,
  pincode: a.pincode,
  landmark: a.landmark ?? "",
  isDefault: a.isDefault,
});

export const formatAddress = (a: Address) =>
  [a.line1, a.line2, a.area, a.landmark, `${a.city}${a.district && a.district !== a.city ? `, ${a.district}` : ""}`, a.state, a.pincode].filter(Boolean).join(", ");

type Target = Address | "new" | null;

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [target, setTarget] = React.useState<Target>(null);
  const [toDelete, setToDelete] = React.useState<Address | null>(null);

  const setDefault = useMutation({ mutationFn: (id: string) => storeApi.setDefaultAddress(id), onSuccess: () => router.refresh() });
  const remove = useMutation({
    mutationFn: (id: string) => storeApi.deleteAddress(id),
    onSuccess: () => {
      setToDelete(null);
      router.refresh();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">{addresses.length ? `${addresses.length} saved ${addresses.length === 1 ? "address" : "addresses"}` : "No saved addresses yet"}</p>
        <Button onClick={() => setTarget("new")}>
          <Plus className="size-4" aria-hidden /> Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <StateMessage icon={MapPin} title="Add your first address" description="Save an address to check out faster." className="py-10" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{a.label}</span>
                {a.isDefault && <StatusBadge label="Default" tone="primary" />}
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium">{a.fullName} · {a.phone}</p>
                <p className="mt-1 text-muted">{formatAddress(a)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setTarget(a)}>
                  <Pencil className="size-3.5" aria-hidden /> Edit
                </Button>
                {!a.isDefault && (
                  <Button size="sm" variant="ghost" loading={setDefault.isPending && setDefault.variables === a.id} onClick={() => setDefault.mutate(a.id)}>
                    Set as default
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="ml-auto text-danger" aria-label={`Delete ${a.label} address`} onClick={() => setToDelete(a)}>
                  <Trash2 className="size-3.5" aria-hidden /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {setDefault.isError && <FormError>{setDefault.error.message}</FormError>}

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {target !== null && <AddressForm key={target === "new" ? "new" : target.id} address={target === "new" ? undefined : target} onDone={() => { setTarget(null); router.refresh(); }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this address?</DialogTitle>
            <DialogDescription>Your past orders keep their delivery address.</DialogDescription>
          </DialogHeader>
          {remove.isError && <FormError>{remove.error.message}</FormError>}
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button variant="danger" loading={remove.isPending} onClick={() => toDelete && remove.mutate(toDelete.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddressForm({ address, onDone }: { address?: Address; onDone: () => void }) {
  const { register, handleSubmit, setError, formState: { errors } } = useForm<AddressFormValues, unknown, AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: address ? addressToForm(address) : emptyAddress,
  });
  const mutation = useMutation({
    mutationFn: (v: AddressInput) => (address ? storeApi.updateAddress(address.id, v) : storeApi.createAddress(v)),
    onSuccess: onDone,
    onError: (err) => {
      if (err instanceof ApiRequestError && err.fields) for (const [k, message] of Object.entries(err.fields)) setError(k as keyof AddressFormValues, { message });
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>{address ? "Edit address" : "Add a new address"}</DialogTitle>
        <DialogDescription>We deliver across India.</DialogDescription>
      </DialogHeader>
      <AddressFields register={register} errors={errors} idPrefix="manage" />
      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
        <label htmlFor="manage-default" className="text-sm font-semibold">Make this my default address</label>
        <Switch id="manage-default" {...register("isDefault")} />
      </div>
      {mutation.isError && <FormError>{mutation.error.message}</FormError>}
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
        <Button type="submit" loading={mutation.isPending}>{address ? "Save changes" : "Save address"}</Button>
      </DialogFooter>
    </form>
  );
}
