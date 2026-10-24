"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cartActions, useCart, useCoupon, setCoupon } from "@/components/store/cart/cart-store";
import { storeApi } from "@/services/store";

/**
 * Prices the local cart on the server (real prices, stock-clamped quantities, coupon, totals).
 * Shared by the cart and checkout pages so there is one validation path.
 */
export function usePricedCart() {
  const cart = useCart();
  const coupon = useCoupon();
  const items = React.useMemo(() => cart.items.map((e) => ({ variantId: e.variantId, quantity: e.quantity })), [cart.items]);
  const signature = items.map((i) => `${i.variantId}:${i.quantity}`).join(",");

  const query = useQuery({
    queryKey: ["priced-cart", signature, coupon],
    queryFn: () => storeApi.validateCart(items, coupon ?? undefined),
    enabled: items.length > 0,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });

  // The server is the source of truth for what's actually available: shrink quantities to match stock.
  React.useEffect(() => {
    for (const line of query.data?.lines ?? []) {
      const local = cart.items.find((e) => e.variantId === line.variantId);
      if (local && line.issue === "reduced" && local.quantity !== line.quantity) cartActions.setQuantity(line.variantId, line.quantity);
    }
  }, [query.data, cart.items]);

  // A coupon the server rejected shouldn't linger.
  React.useEffect(() => {
    if (coupon && query.data && query.data.totals.couponError && !query.isPlaceholderData) setCoupon(null);
  }, [coupon, query.data, query.isPlaceholderData]);

  return { cart, coupon, ...query };
}
