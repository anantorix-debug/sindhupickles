import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { AuthCard } from "@/components/store/forms/auth-card";
import { DirectResetForm, ForgotPasswordForm } from "@/components/store/forms/auth-forms";
import { getSettings } from "@/server/repositories/settings";

export const metadata: Metadata = { title: "Forgot password", description: "Reset the password for your Sindhu's Pickles account.", alternates: { canonical: "/forgot-password" } };

export default async function ForgotPasswordPage() {
  const { selfPasswordReset, supportPhone, supportEmail } = await getSettings();
  // The owner's choice (Admin -> Settings): customers set a new password with just their email.
  if (selfPasswordReset) {
    return (
      <AuthCard title="Forgot your password?" description="Enter your account email and choose a new password.">
        <DirectResetForm />
      </AuthCard>
    );
  }
  // Without an email server the reset link could never arrive, so customers are asked to contact the shop instead;
  // the owner sets a new password in Admin -> Customers. The email form returns automatically once SMTP is configured.
  if (!process.env.SMTP_HOST) {
    const tel = supportPhone.replace(/[^\d+]/g, "");
    return (
      <AuthCard title="Forgot your password?" description="We'll reset it for you.">
        <div className="space-y-4 text-sm leading-relaxed text-muted">
          <p>Please call or message us from the phone number on your account and we&apos;ll set a new password for you straight away.</p>
          <a href={`tel:${tel}`} className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary-hover">
            <Phone className="size-4" aria-hidden /> {supportPhone}
          </a>
          {supportEmail && (
            <p className="text-center">
              or email <a href={`mailto:${supportEmail}`} className="font-semibold text-accent hover:underline">{supportEmail}</a>
            </p>
          )}
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Forgot your password?" description="Enter your email and we'll send you a link to set a new one.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
