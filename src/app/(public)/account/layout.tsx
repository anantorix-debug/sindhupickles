import type { Metadata } from "next";
import { StoreProviders } from "@/components/store/providers";
import { AccountNav } from "@/components/store/account/account-nav";
import { PageContainer } from "@/components/store/common/section-heading";
import { requireCustomerPage } from "@/server/store/page-auth";

export const metadata: Metadata = { title: { default: "My Account", template: "%s | My Account" }, robots: { index: false, follow: false } };

// Per-customer pages: always rendered fresh, never cached or shared.
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const me = await requireCustomerPage("/account");
  return (
    <PageContainer className="py-8 sm:py-12">
      <header className="mb-8">
        <p className="text-sm text-muted">Signed in as {me.email}</p>
        <h1 className="font-display text-3xl font-black sm:text-4xl">Hello, {me.name.split(" ")[0]}</h1>
      </header>
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <StoreProviders>
          <AccountNav />
          <div className="min-w-0">{children}</div>
        </StoreProviders>
      </div>
    </PageContainer>
  );
}
