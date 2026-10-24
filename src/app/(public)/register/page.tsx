import type { Metadata } from "next";
import { AuthCard } from "@/components/store/forms/auth-card";
import { RegisterForm } from "@/components/store/forms/auth-forms";
import { redirectIfSignedIn, safeNext } from "@/server/store/page-auth";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  await redirectIfSignedIn(next);
  return (
    <AuthCard title="Create your account" description="Save addresses, track orders and reorder your favourites.">
      <RegisterForm next={next} />
    </AuthCard>
  );
}
