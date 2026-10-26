import type { Metadata } from "next";
import { PageContainer } from "@/components/store/common/section-heading";
import { StoreProviders } from "@/components/store/providers";
import { CartView } from "@/components/store/cart/cart-view";

export const metadata: Metadata = { title: "Your Cart", description: "Review the homemade pickles in your cart and check out securely.", alternates: { canonical: "/cart" } };

export default function CartPage() {
  return (
    <PageContainer className="py-8 sm:py-12">
      <h1 className="mb-8 font-display text-3xl font-black sm:text-4xl">Your Cart</h1>
      <StoreProviders>
        <CartView />
      </StoreProviders>
    </PageContainer>
  );
}
