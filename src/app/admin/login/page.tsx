import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/forms/login-form";
import { QueryProvider } from "@/components/admin/layout/query-provider";
import { Logo } from "@/components/admin/common/logo";
import { Card } from "@/components/ui/card";
import { getSignedInAdmin } from "@/server/admin/auth";
import { safeNext } from "@/server/store/page-auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const raw = (await searchParams).next;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  // Only admin pages are valid destinations (and never an open redirect).
  const next = safeNext(requested, "/admin/dashboard").startsWith("/admin") ? safeNext(requested, "/admin/dashboard") : "/admin/dashboard";

  if (await getSignedInAdmin()) redirect(next);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Logo className="mb-8 justify-center" />
        <Card className="p-6 sm:p-8">
          <h1 className="font-display text-2xl font-black">Admin sign in</h1>
          <p className="mb-6 mt-1 text-sm text-muted">Sign in to manage the store.</p>
          <QueryProvider>
            <LoginForm next={next} />
          </QueryProvider>
        </Card>
      </div>
    </main>
  );
}
