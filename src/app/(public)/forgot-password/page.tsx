import type { Metadata } from "next";
import { AuthCard } from "@/components/store/forms/auth-card";
import { ForgotPasswordForm } from "@/components/store/forms/auth-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?" description="Enter your email and we'll send you a link to set a new one.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
