"use client";

import * as React from "react";
import { Check, ShoppingCart } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cartActions, type CartSnapshot } from "@/components/store/cart/cart-store";

interface AddToCartButtonProps extends Omit<ButtonProps, "onClick"> {
  variantId: string;
  snapshot: CartSnapshot;
  quantity?: number;
  label?: string;
}

/** Adds one variant to the shared cart; the header count updates immediately. */
export function AddToCartButton({ variantId, snapshot, quantity = 1, label = "Add to Cart", size = "sm", disabled, ...props }: AddToCartButtonProps) {
  const [added, setAdded] = React.useState(false);
  React.useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <Button
      type="button"
      size={size}
      disabled={disabled}
      onClick={() => {
        cartActions.add(variantId, snapshot, quantity);
        setAdded(true);
      }}
      {...props}
    >
      {added ? <Check className="size-3.5" aria-hidden /> : <ShoppingCart className="size-3.5" aria-hidden />}
      <span aria-live="polite">{added ? "Added" : label}</span>
    </Button>
  );
}
