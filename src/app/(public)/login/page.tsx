import type { Metadata } from "next";
import { AuthCard } from "@/components/store/forms/auth-card";
import { LoginForm } from "@/components/store/forms/auth-forms";
import { redirectIfSignedIn, safeNext } from "@/server/store/page-auth";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to your Sindhu's Pickles account to track orders, save addresses and check out faster.", alternates: { canonical: "/login" } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  await redirectIfSignedIn(next);
  return (
    <AuthCard title="Welcome back" description="Sign in to track orders and check out faster.">
      <LoginForm next={next} />
    </AuthCard>
  );
}
