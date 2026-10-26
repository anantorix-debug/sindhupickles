"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField, fieldA11y } from "@/components/admin/forms/form-field";
import { FormError, FormSuccess } from "@/components/admin/forms/form-feedback";
import { adminSetPasswordSchema, type AdminSetPasswordFormValues, type AdminSetPasswordInput } from "@/lib/validation/store";
import { api, ApiRequestError } from "@/services/api-client";

/** Lets the shop owner set a new password for a customer who forgot theirs (after checking it is really them). */
export function CustomerPasswordDialog({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <KeyRound className="size-4" aria-hidden /> Set new password
        </Button>
      </DialogTrigger>
      <DialogContent>{open && <PasswordForm customerId={customerId} customerName={customerName} />}</DialogContent>
    </Dialog>
  );
}

function PasswordForm({ customerId, customerName }: { customerId: string; customerName: string }) {
  const { register, handleSubmit, setError, formState: { errors } } = useForm<AdminSetPasswordFormValues, unknown, AdminSetPasswordInput>({
    resolver: zodResolver(adminSetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const mutation = useMutation({
    mutationFn: (v: AdminSetPasswordInput) => api(`/customers/${customerId}/password`, { method: "PUT", body: v }),
    onError: (err) => {
      if (err instanceof ApiRequestError && err.fields) for (const [k, message] of Object.entries(err.fields)) setError(k as keyof AdminSetPasswordFormValues, { message });
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>Set a new password</DialogTitle>
        <DialogDescription>
          For {customerName}. Only do this after checking it is really them (for example, they called from their registered phone number). Tell them the new
          password; they can change it later in their account.
        </DialogDescription>
      </DialogHeader>
      {mutation.isSuccess ? (
        <FormSuccess>Password updated. {customerName} can now sign in with the new password.</FormSuccess>
      ) : (
        <>
          <FormField label="New password" htmlFor="new-password" required error={errors.password?.message} hint="At least 8 characters, with a letter and a number.">
            <PasswordInput {...fieldA11y("new-password", errors.password?.message, true)} autoComplete="new-password" {...register("password")} />
          </FormField>
          <FormField label="Confirm new password" htmlFor="confirm-password" required error={errors.confirmPassword?.message}>
            <PasswordInput {...fieldA11y("confirm-password", errors.confirmPassword?.message)} autoComplete="new-password" {...register("confirmPassword")} />
          </FormField>
          {mutation.isError && !(mutation.error instanceof ApiRequestError && mutation.error.fields) && <FormError>{mutation.error.message}</FormError>}
        </>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">{mutation.isSuccess ? "Close" : "Cancel"}</Button>
        </DialogClose>
        {!mutation.isSuccess && <Button type="submit" loading={mutation.isPending}>Save new password</Button>}
      </DialogFooter>
    </form>
  );
}
