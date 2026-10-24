"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, fieldA11y } from "@/components/admin/forms/form-field";
import { FormError } from "@/components/admin/forms/form-feedback";
import { signIn } from "@/services/auth";

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (v: Values) => signIn(v),
    onSuccess: () => {
      router.push(next);
      router.refresh();
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-5">
      <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
        <Input {...fieldA11y("email", errors.email?.message)} type="email" autoComplete="username" placeholder="admin@sindhuspickles.com" {...register("email")} />
      </FormField>
      <FormField label="Password" htmlFor="password" required error={errors.password?.message}>
        <Input {...fieldA11y("password", errors.password?.message)} type="password" autoComplete="current-password" {...register("password")} />
      </FormField>
      {mutation.isError && <FormError>{mutation.error.message}</FormError>}
      <Button type="submit" size="lg" className="w-full" loading={mutation.isPending || mutation.isSuccess}>
        Sign in
      </Button>
    </form>
  );
}
