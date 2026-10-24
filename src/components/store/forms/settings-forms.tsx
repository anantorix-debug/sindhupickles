"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { FormError, FormSuccess } from "@/components/ui/form-feedback";
import { changePasswordSchema, type ChangePasswordFormValues, type ChangePasswordInput } from "@/lib/validation/store";
import { ApiRequestError } from "@/services/api-client";
import { storeApi } from "@/services/store";
import type { CustomerPreferences } from "@/types/store";

export function ChangePasswordForm() {
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<ChangePasswordFormValues, unknown, ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });
  const mutation = useMutation({
    mutationFn: storeApi.changePassword,
    onSuccess: () => reset(),
    onError: (err) => {
      if (err instanceof ApiRequestError && err.fields) for (const [k, message] of Object.entries(err.fields)) setError(k as keyof ChangePasswordFormValues, { message });
    },
  });

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-5 font-display text-xl font-bold">Password</h2>
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="grid max-w-xl gap-5">
        <FormField label="Current password" htmlFor="currentPassword" required error={errors.currentPassword?.message}>
          <Input {...fieldA11y("currentPassword", errors.currentPassword?.message)} type="password" autoComplete="current-password" {...register("currentPassword")} />
        </FormField>
        <FormField label="New password" htmlFor="newPassword" required error={errors.newPassword?.message} hint="8+ characters, letters and numbers.">
          <Input {...fieldA11y("newPassword", errors.newPassword?.message, true)} type="password" autoComplete="new-password" {...register("newPassword")} />
        </FormField>
        <FormField label="Confirm new password" htmlFor="confirmPassword" required error={errors.confirmPassword?.message}>
          <Input {...fieldA11y("confirmPassword", errors.confirmPassword?.message)} type="password" autoComplete="new-password" {...register("confirmPassword")} />
        </FormField>
        {mutation.isSuccess && <FormSuccess>Password updated.</FormSuccess>}
        {mutation.isError && !(mutation.error instanceof ApiRequestError && mutation.error.fields) && <FormError>{mutation.error.message}</FormError>}
        <div><Button type="submit" loading={mutation.isPending}>Update password</Button></div>
      </form>
    </Card>
  );
}

export function PreferencesForm({ initial }: { initial: CustomerPreferences }) {
  const [prefs, setPrefs] = React.useState(initial);
  const mutation = useMutation({ mutationFn: storeApi.updatePreferences });

  const toggle = (key: keyof CustomerPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    mutation.mutate(next, { onError: () => setPrefs(prefs) });
  };

  const rows: [keyof CustomerPreferences, string, string][] = [
    ["orderUpdates", "Order updates", "Emails about your order status and delivery."],
    ["offers", "Offers & new flavours", "Occasional news about new batches and discounts."],
  ];
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-5 font-display text-xl font-bold">Notification preferences</h2>
      <ul className="divide-y divide-border">
        {rows.map(([key, title, hint]) => (
          <li key={key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <div>
              <label htmlFor={key} className="font-semibold">{title}</label>
              <p className="text-sm text-muted">{hint}</p>
            </div>
            <Switch id={key} checked={prefs[key]} onChange={() => toggle(key)} disabled={mutation.isPending} />
          </li>
        ))}
      </ul>
      {mutation.isError && <div className="mt-4"><FormError>Couldn&apos;t save your preference. Please try again.</FormError></div>}
    </Card>
  );
}
