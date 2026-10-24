import type { Metadata } from "next";
import { PageContainer } from "@/components/store/common/section-heading";
import { StoreProviders } from "@/components/store/providers";
import { CheckoutView } from "@/components/store/checkout/checkout-view";
import { listAddresses } from "@/server/store/addresses";
import { requireCustomerPage } from "@/server/store/page-auth";
import { listAvailableProviders } from "@/server/store/payments/providers";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const me = await requireCustomerPage("/checkout");
  const addresses = await listAddresses(me.id);
  const available = await listAvailableProviders();
  // The dev-only "Test payment" is a stand-in for Razorpay, so it is hidden once Razorpay is configured.
  const shown = available.some((p) => p.id === "razorpay") ? available.filter((p) => p.id !== "mock") : available;
  const paymentOptions = shown.map((p) => ({ id: p.id, label: p.label, description: p.description }));

  return (
    <PageContainer className="py-8 sm:py-12">
      <h1 className="mb-8 font-display text-3xl font-black sm:text-4xl">Checkout</h1>
      <StoreProviders>
        <CheckoutView addresses={addresses} paymentOptions={paymentOptions} defaultName={me.name} defaultPhone={me.phone} />
      </StoreProviders>
    </PageContainer>
  );
}
