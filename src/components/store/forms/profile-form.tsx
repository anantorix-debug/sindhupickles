"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { refreshMe } from "@/components/store/layout/me-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { FormError, FormSuccess } from "@/components/ui/form-feedback";
import { profileSchema, type ProfileFormValues, type ProfileInput } from "@/lib/validation/store";
import { storeApi } from "@/services/store";
import type { CustomerProfile } from "@/types/store";

export function ProfileForm({ profile }: { profile: CustomerProfile }) {
  const router = useRouter();
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileFormValues, unknown, ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile.name, phone: profile.phone },
  });
  const mutation = useMutation({
    mutationFn: storeApi.updateProfile,
    onSuccess: (saved) => {
      reset({ name: saved.name, phone: saved.phone });
      void refreshMe();
      router.refresh();
    },
  });

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-5 font-display text-xl font-bold">Personal information</h2>
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="grid gap-5 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="name" required error={errors.name?.message}>
          <Input {...fieldA11y("name", errors.name?.message)} autoComplete="name" {...register("name")} />
        </FormField>
        <FormField label="Mobile number" htmlFor="phone" required error={errors.phone?.message}>
          <Input {...fieldA11y("phone", errors.phone?.message)} type="tel" inputMode="numeric" autoComplete="tel-national" {...register("phone")} />
        </FormField>
        <FormField label="Email" htmlFor="email" hint="Your email is your sign-in and can't be changed here.">
          <Input id="email" value={profile.email} readOnly disabled aria-describedby="email-msg" />
        </FormField>
        <div className="space-y-3 sm:col-span-2">
          {mutation.isSuccess && !isDirty && <FormSuccess>Profile updated.</FormSuccess>}
          {mutation.isError && <FormError>{mutation.error.message}</FormError>}
          <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>Save changes</Button>
        </div>
      </form>
    </Card>
  );
}
