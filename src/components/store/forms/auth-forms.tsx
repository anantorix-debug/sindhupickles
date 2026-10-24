"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { refreshMe } from "@/components/store/layout/me-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { FormError, FormSuccess } from "@/components/ui/form-feedback";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type LoginFormValues,
  type LoginInput,
  type RegisterFormValues,
  type RegisterInput,
  type ResetPasswordFormValues,
  type ResetPasswordInput,
} from "@/lib/validation/store";
import { ApiRequestError } from "@/services/api-client";
import { storeApi } from "@/services/store";

function useServerFieldErrors<T extends Record<string, unknown>>(setError: (name: keyof T & string, e: { message: string }) => void) {
  return (err: unknown) => {
    if (err instanceof ApiRequestError && err.fields) for (const [k, message] of Object.entries(err.fields)) setError(k as keyof T & string, { message });
  };
}

function useAfterAuth(next: string) {
  const router = useRouter();
  return async () => {
    await refreshMe();
    router.push(next);
    router.refresh();
  };
}

export function LoginForm({ next }: { next: string }) {
  const afterAuth = useAfterAuth(next);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues, unknown, LoginInput>({ resolver: zodResolver(loginSchema) });
  const mutation = useMutation({ mutationFn: storeApi.login, onSuccess: afterAuth });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-5">
      <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
        <Input {...fieldA11y("email", errors.email?.message)} type="email" autoComplete="email" inputMode="email" {...register("email")} />
      </FormField>
      <FormField label="Password" htmlFor="password" required error={errors.password?.message}>
        <Input {...fieldA11y("password", errors.password?.message)} type="password" autoComplete="current-password" {...register("password")} />
      </FormField>
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="text-accent hover:underline">Forgot password?</Link>
      </div>
      {mutation.isError && <FormError>{mutation.error.message}</FormError>}
      <Button type="submit" size="lg" className="w-full" loading={mutation.isPending || mutation.isSuccess}>Sign in</Button>
      <p className="text-center text-sm text-muted">
        New here? <Link href={`/register${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-accent hover:underline">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const afterAuth = useAfterAuth(next);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<RegisterFormValues, unknown, RegisterInput>({ resolver: zodResolver(registerSchema) });
  const onFieldErrors = useServerFieldErrors<RegisterFormValues>(setError as never);
  const mutation = useMutation({ mutationFn: storeApi.register, onSuccess: afterAuth, onError: onFieldErrors });
  const apiError = mutation.error instanceof ApiRequestError ? mutation.error : null;

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-5">
      <FormField label="Full name" htmlFor="name" required error={errors.name?.message}>
        <Input {...fieldA11y("name", errors.name?.message)} autoComplete="name" {...register("name")} />
      </FormField>
      <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
        <Input {...fieldA11y("email", errors.email?.message)} type="email" autoComplete="email" inputMode="email" {...register("email")} />
      </FormField>
      <FormField label="Mobile number" htmlFor="phone" required error={errors.phone?.message} hint="10-digit Indian mobile number.">
        <Input {...fieldA11y("phone", errors.phone?.message, true)} type="tel" autoComplete="tel-national" inputMode="numeric" {...register("phone")} />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Password" htmlFor="password" required error={errors.password?.message} hint="8+ characters, letters and numbers.">
          <Input {...fieldA11y("password", errors.password?.message, true)} type="password" autoComplete="new-password" {...register("password")} />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirmPassword" required error={errors.confirmPassword?.message}>
          <Input {...fieldA11y("confirmPassword", errors.confirmPassword?.message)} type="password" autoComplete="new-password" {...register("confirmPassword")} />
        </FormField>
      </div>
      {mutation.isError && !apiError?.fields && <FormError>{(mutation.error as Error).message}</FormError>}
      {apiError?.status === 409 && (
        <p className="text-sm text-muted">
          Already ordered with us before? <Link href="/forgot-password" className="font-semibold text-accent hover:underline">Set your password</Link>.
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={mutation.isPending || mutation.isSuccess}>Create account</Button>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href={`/login${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-accent hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordSchema) as never });
  const mutation = useMutation({ mutationFn: storeApi.forgotPassword });

  if (mutation.isSuccess) {
    return (
      <div className="space-y-4">
        <FormSuccess>If that email is registered, we&apos;ve sent a link to reset your password. It&apos;s valid for 1 hour.</FormSuccess>
        <Button asChild variant="secondary" className="w-full"><Link href="/login">Back to sign in</Link></Button>
      </div>
    );
  }
  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v as never))} noValidate className="space-y-5">
      <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
        <Input {...fieldA11y("email", errors.email?.message)} type="email" autoComplete="email" inputMode="email" {...register("email")} />
      </FormField>
      {mutation.isError && <FormError>{mutation.error.message}</FormError>}
      <Button type="submit" size="lg" className="w-full" loading={mutation.isPending}>Send reset link</Button>
      <p className="text-center text-sm"><Link href="/login" className="text-accent hover:underline">Back to sign in</Link></p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormValues, unknown, ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });
  const mutation = useMutation({ mutationFn: storeApi.resetPassword });

  if (mutation.isSuccess) {
    return (
      <div className="space-y-4">
        <FormSuccess>Your password has been updated.</FormSuccess>
        <Button asChild size="lg" className="w-full"><Link href="/login">Sign in</Link></Button>
      </div>
    );
  }
  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-5">
      <input type="hidden" {...register("token")} />
      {errors.token && <FormError>{errors.token.message}</FormError>}
      <FormField label="New password" htmlFor="password" required error={errors.password?.message} hint="8+ characters, letters and numbers.">
        <Input {...fieldA11y("password", errors.password?.message, true)} type="password" autoComplete="new-password" {...register("password")} />
      </FormField>
      <FormField label="Confirm new password" htmlFor="confirmPassword" required error={errors.confirmPassword?.message}>
        <Input {...fieldA11y("confirmPassword", errors.confirmPassword?.message)} type="password" autoComplete="new-password" {...register("confirmPassword")} />
      </FormField>
      {mutation.isError && <FormError>{mutation.error.message}</FormError>}
      <Button type="submit" size="lg" className="w-full" loading={mutation.isPending}>Update password</Button>
    </form>
  );
}
