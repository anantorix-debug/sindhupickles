"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { FormError, FormSuccess } from "@/components/ui/form-feedback";
import { enquirySchema, type EnquiryFormValues, type EnquiryInput } from "@/lib/validation/store";
import { api } from "@/services/api-client";

export function ContactForm() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EnquiryFormValues, unknown, EnquiryInput>({
    resolver: zodResolver(enquirySchema),
    defaultValues: { phone: "", website: "" },
  });
  const mutation = useMutation({
    mutationFn: (v: EnquiryInput) => api("/store/enquiries", { method: "POST", body: v }),
    onSuccess: () => reset(),
  });

  if (mutation.isSuccess) {
    return <FormSuccess>Thank you! We&apos;ve received your message and will get back to you soon.</FormSuccess>;
  }

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="grid gap-5 sm:grid-cols-2">
      <FormField label="Your name" htmlFor="name" required error={errors.name?.message}>
        <Input {...fieldA11y("name", errors.name?.message)} autoComplete="name" {...register("name")} />
      </FormField>
      <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
        <Input {...fieldA11y("email", errors.email?.message)} type="email" autoComplete="email" inputMode="email" {...register("email")} />
      </FormField>
      <FormField label="Mobile (optional)" htmlFor="phone" error={errors.phone?.message} className="sm:col-span-2">
        <Input {...fieldA11y("phone", errors.phone?.message)} type="tel" inputMode="numeric" autoComplete="tel-national" {...register("phone")} />
      </FormField>
      <FormField label="Message" htmlFor="message" required error={errors.message?.message} className="sm:col-span-2">
        <Textarea {...fieldA11y("message", errors.message?.message)} rows={5} {...register("message")} />
      </FormField>
      {/* Honeypot — hidden from people, tempting to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>
      <div className="space-y-3 sm:col-span-2">
        {mutation.isError && <FormError>{mutation.error.message}</FormError>}
        <Button type="submit" size="lg" loading={mutation.isPending}>Send message</Button>
      </div>
    </form>
  );
}
