"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormField, fieldA11y } from "@/components/admin/forms/form-field";
import { FormError, FormSuccess } from "@/components/admin/forms/form-feedback";
import { settingsSchema, type SettingsFormValues } from "@/lib/validation/settings";
import { updateSettings } from "@/services/settings";
import type { StoreSettings } from "@/types";

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema), defaultValues: settings });

  const mutation = useMutation({
    mutationFn: (values: SettingsFormValues) => updateSettings(values),
    onSuccess: (saved) => reset(saved),
  });

  const num = (name: keyof SettingsFormValues) => register(name, { valueAsNumber: true });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Store profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField label="Store name" htmlFor="storeName" required error={errors.storeName?.message}>
            <Input {...fieldA11y("storeName", errors.storeName?.message)} {...register("storeName")} />
          </FormField>
          <FormField label="Tagline" htmlFor="tagline" error={errors.tagline?.message}>
            <Input {...fieldA11y("tagline", errors.tagline?.message)} {...register("tagline")} />
          </FormField>
          <FormField label="Support email" htmlFor="supportEmail" required error={errors.supportEmail?.message}>
            <Input {...fieldA11y("supportEmail", errors.supportEmail?.message)} type="email" autoComplete="email" {...register("supportEmail")} />
          </FormField>
          <FormField label="Support phone" htmlFor="supportPhone" required error={errors.supportPhone?.message}>
            <Input {...fieldA11y("supportPhone", errors.supportPhone?.message)} type="tel" autoComplete="tel" {...register("supportPhone")} />
          </FormField>
          <FormField label="Address" htmlFor="address" required error={errors.address?.message} className="sm:col-span-2">
            <Textarea {...fieldA11y("address", errors.address?.message)} rows={3} {...register("address")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping &amp; offers</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Currency" htmlFor="currency">
            <Select {...fieldA11y("currency")} {...register("currency")}>
              <option value="INR">INR (₹)</option>
            </Select>
          </FormField>
          <FormField label="Shipping fee (₹)" htmlFor="shippingFee" required error={errors.shippingFee?.message}>
            <Input {...fieldA11y("shippingFee", errors.shippingFee?.message)} type="number" inputMode="numeric" min={0} {...num("shippingFee")} />
          </FormField>
          <FormField label="Free shipping above (₹)" htmlFor="freeShippingThreshold" required error={errors.freeShippingThreshold?.message}>
            <Input {...fieldA11y("freeShippingThreshold", errors.freeShippingThreshold?.message)} type="number" inputMode="numeric" min={0} {...num("freeShippingThreshold")} />
          </FormField>
          <FormField label="First-order coupon" htmlFor="welcomeCoupon" error={errors.welcomeCoupon?.message}>
            <Input {...fieldA11y("welcomeCoupon", errors.welcomeCoupon?.message)} className="uppercase" {...register("welcomeCoupon")} />
          </FormField>
          <FormField label="Coupon discount (%)" htmlFor="welcomeCouponPct" required error={errors.welcomeCouponPct?.message}>
            <Input {...fieldA11y("welcomeCouponPct", errors.welcomeCouponPct?.message)} type="number" inputMode="numeric" min={0} max={100} {...num("welcomeCouponPct")} />
          </FormField>
          <FormField label="Default low-stock alert" htmlFor="lowStockDefault" required error={errors.lowStockDefault?.message}>
            <Input {...fieldA11y("lowStockDefault", errors.lowStockDefault?.message)} type="number" inputMode="numeric" min={0} {...num("lowStockDefault")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="codEnabled" className="text-sm font-semibold">Cash on delivery</label>
              <p className="text-xs text-muted">Let customers choose to pay in cash when the parcel arrives. COD orders are placed immediately.</p>
            </div>
            <Switch id="codEnabled" {...register("codEnabled")} />
          </div>
          <p className="text-xs text-muted">Online payment (Razorpay) is configured on the server and is always offered when it is set up.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="selfPasswordReset" className="text-sm font-semibold">Reset password without email check</label>
              <p className="text-xs text-muted">
                On the Forgot password page, customers type their email and a new password, with no code or link. Anyone who knows a
                customer&apos;s email can change that customer&apos;s password, so switch this off once email is set up.
              </p>
            </div>
            <Switch id="selfPasswordReset" {...register("selfPasswordReset")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social links</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          {(
            [
              ["instagramUrl", "Instagram"],
              ["facebookUrl", "Facebook"],
              ["youtubeUrl", "YouTube"],
            ] as const
          ).map(([name, label]) => (
            <FormField key={name} label={label} htmlFor={name} error={errors[name]?.message} hint="Shown in the storefront footer.">
              <Input {...fieldA11y(name, errors[name]?.message, true)} type="url" placeholder="https://" {...register(name)} />
            </FormField>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["notifyNewOrder", "New order alerts", "Get notified whenever a customer places an order."],
              ["notifyLowStock", "Low-stock alerts", "Get notified when a product drops below its alert level."],
            ] as const
          ).map(([name, title, hint]) => (
            <div key={name} className="flex items-center justify-between gap-4">
              <div>
                <label htmlFor={name} className="text-sm font-semibold">{title}</label>
                <p className="text-xs text-muted">{hint}</p>
              </div>
              <Switch id={name} {...register(name)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {mutation.isSuccess && !isDirty && <FormSuccess>Settings saved.</FormSuccess>}
      {mutation.isError && <FormError>Could not save settings. Please try again.</FormError>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={!isDirty || mutation.isPending} onClick={() => reset(settings)}>
          Reset
        </Button>
        <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
