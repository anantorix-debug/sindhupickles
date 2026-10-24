import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/store/forms/auth-card";
import { ResetPasswordForm } from "@/components/store/forms/auth-forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return (
    <AuthCard title="Set a new password">
      {token.length < 20 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">This reset link is missing or invalid.</p>
          <Button asChild className="w-full"><Link href="/forgot-password">Request a new link</Link></Button>
        </div>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </AuthCard>
  );
}
