"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/store/cart/add-to-cart-button";
import { cartActions, MAX_CART_QTY } from "@/components/store/cart/cart-store";
import { Price } from "@/components/store/common/price";
import { cn } from "@/lib/utils";
import type { StoreVariant } from "@/types/store";

interface PurchasePanelProps {
  product: { slug: string; name: string; imageUrl: string | null };
  variants: StoreVariant[];
}

/** Pack-size selector, quantity stepper and add-to-cart / buy-now. Stock shown here is re-checked by the server at checkout. */
export function PurchasePanel({ product, variants }: PurchasePanelProps) {
  const router = useRouter();
  const firstBuyable = variants.find((v) => v.inStock) ?? variants[0];
  const [variantId, setVariantId] = React.useState(firstBuyable?.id);
  const [qty, setQty] = React.useState(1);
  const variant = variants.find((v) => v.id === variantId) ?? firstBuyable;

  if (!variant) {
    return <p className="rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">This product isn&apos;t available to order right now.</p>;
  }

  const maxQty = Math.max(Math.min(variant.available, MAX_CART_QTY), 1);
  const snapshot = { slug: product.slug, name: product.name, variantLabel: variant.label, price: variant.price, imageUrl: product.imageUrl };
  const stockText = !variant.inStock ? "Out of stock" : variant.available <= 5 ? `Only ${variant.available} left` : "In stock";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Price price={variant.price} compareAt={variant.compareAtPrice} size="lg" />
        <p className={cn("text-sm font-semibold", variant.inStock ? (variant.available <= 5 ? "text-warning" : "text-success") : "text-danger")} role="status">
          {stockText}
        </p>
      </div>

      {variants.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Pack size</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <label
                key={v.id}
                className={cn(
                  "relative cursor-pointer rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                  v.id === variant.id ? "border-primary bg-accent-soft text-accent" : "border-border bg-surface hover:border-muted",
                  !v.inStock && "opacity-60",
                )}
              >
                <input
                  type="radio"
                  name="pack"
                  value={v.id}
                  checked={v.id === variant.id}
                  onChange={() => {
                    setVariantId(v.id);
                    setQty((q) => Math.min(q, Math.max(Math.min(v.available, MAX_CART_QTY), 1)));
                  }}
                  className="sr-only"
                />
                {v.label}
                {!v.inStock && <span className="ml-1 text-xs font-normal">(sold out)</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-md border border-border bg-surface" role="group" aria-label="Quantity">
          <Button type="button" variant="ghost" size="icon" aria-label="Decrease quantity" disabled={!variant.inStock || qty <= 1} onClick={() => setQty((q) => Math.max(q - 1, 1))}>
            <Minus className="size-4" aria-hidden />
          </Button>
          <span className="w-10 text-center font-semibold tabular-nums" aria-live="polite">
            {qty}
          </span>
          <Button type="button" variant="ghost" size="icon" aria-label="Increase quantity" disabled={!variant.inStock || qty >= maxQty} onClick={() => setQty((q) => Math.min(q + 1, maxQty))}>
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
        <AddToCartButton variantId={variant.id} snapshot={snapshot} quantity={qty} size="lg" disabled={!variant.inStock} className="flex-1 sm:flex-none" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={!variant.inStock}
        className="w-full sm:w-auto"
        onClick={() => {
          cartActions.add(variant.id, snapshot, qty);
          router.push("/checkout");
        }}
      >
        <ShoppingBag className="size-4" aria-hidden /> Buy it now
      </Button>
    </div>
  );
}
