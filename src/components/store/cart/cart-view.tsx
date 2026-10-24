"use client";

import * as React from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, TriangleAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { OrderTotals } from "@/components/store/cart/order-summary";
import { cartActions, MAX_CART_QTY, setCoupon } from "@/components/store/cart/cart-store";
import { usePricedCart } from "@/components/store/cart/use-priced-cart";
import { Price } from "@/components/store/common/price";
import { ProductImage } from "@/components/store/common/product-image";
import { StateMessage } from "@/components/store/common/state-message";
import type { PricedCartLine } from "@/types/store";

const issueText: Record<string, string> = {
  unavailable: "No longer available",
  out_of_stock: "Out of stock",
  reduced: "Quantity reduced to what's in stock",
};

export function CartView() {
  const { cart, coupon, data, isLoading, isError, refetch, isFetching } = usePricedCart();
  const [code, setCode] = React.useState("");

  if (cart.items.length === 0) {
    return (
      <StateMessage
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Looks like you haven't added any pickles yet."
        action={
          <Button asChild size="lg">
            <Link href="/shop">Continue shopping</Link>
          </Button>
        }
      />
    );
  }

  if (isError) {
    return (
      <StateMessage
        icon={TriangleAlert}
        title="We couldn't load your cart"
        description="Please check your connection and try again."
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    );
  }

  // Until the server answers, render the add-time snapshot so the page isn't blank.
  const lines: (PricedCartLine | null)[] = data
    ? data.lines
    : cart.items.map(() => null);
  const hasBlocking = data?.lines.some((l) => l.issue === "unavailable" || l.issue === "out_of_stock") ?? false;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section aria-labelledby="cart-items">
        <h2 id="cart-items" className="sr-only">Items in your cart</h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {cart.items.map((entry, i) => {
            const line = lines[i];
            const imageUrl = line?.imageUrl ?? entry.snapshot.imageUrl;
            const name = line?.name ?? entry.snapshot.name;
            const slug = line?.slug || entry.snapshot.slug;
            const blocked = line?.issue === "unavailable" || line?.issue === "out_of_stock";
            const max = Math.min(line?.available ?? MAX_CART_QTY, MAX_CART_QTY);
            return (
              <li key={entry.variantId} className="flex gap-4 p-4 sm:p-5">
                <Link href={`/product/${slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-md bg-surface-raised sm:size-24">
                  <ProductImage src={imageUrl} alt={name} sizes="96px" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/product/${slug}`} className="line-clamp-2 font-display text-base font-bold hover:text-accent sm:text-lg">
                        {name}
                      </Link>
                      <p className="text-xs font-semibold uppercase text-accent">{line?.variantLabel ?? entry.snapshot.variantLabel}</p>
                    </div>
                    <p className="shrink-0 font-bold">{line ? (blocked ? "—" : `₹${line.lineTotal.toLocaleString("en-IN")}`) : <Skeleton className="h-5 w-16" />}</p>
                  </div>

                  {line?.issue && (
                    <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                      <TriangleAlert className="size-3.5" aria-hidden /> {issueText[line.issue]}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-md border border-border" role="group" aria-label={`Quantity for ${name}`}>
                      <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Decrease quantity" disabled={blocked} onClick={() => cartActions.setQuantity(entry.variantId, entry.quantity - 1)}>
                        <Minus className="size-4" aria-hidden />
                      </Button>
                      <span className="w-9 text-center text-sm font-semibold tabular-nums">{entry.quantity}</span>
                      <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Increase quantity" disabled={blocked || entry.quantity >= max} onClick={() => cartActions.setQuantity(entry.variantId, entry.quantity + 1)}>
                        <Plus className="size-4" aria-hidden />
                      </Button>
                    </div>
                    <div className="flex items-center gap-4">
                      {line && !blocked && <Price price={line.unitPrice} compareAt={line.compareAtPrice} className="text-sm [&_span]:text-sm [&_span]:font-medium" />}
                      <button type="button" onClick={() => cartActions.remove(entry.variantId)} className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline">
                        <Trash2 className="size-3.5" aria-hidden /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex justify-between">
          <Button asChild variant="ghost">
            <Link href="/shop">← Continue shopping</Link>
          </Button>
          <Button variant="ghost" onClick={() => cartActions.clear()}>
            Clear cart
          </Button>
        </div>
      </section>

      <aside aria-label="Order summary">
        <Card className="space-y-5 p-5 sm:p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-xl font-bold">Order summary</h2>

          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) setCoupon(code.trim().toUpperCase());
              setCode("");
            }}
          >
            <label htmlFor="coupon" className="text-sm font-semibold">Coupon code</label>
            <div className="flex gap-2">
              <Input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} placeholder={coupon ?? "Enter code"} className="uppercase" autoComplete="off" />
              <Button type="submit" variant="secondary" disabled={!code.trim()}>Apply</Button>
            </div>
            {coupon && data?.totals.couponCode && (
              <p className="flex items-center justify-between text-xs font-medium text-success">
                {data.totals.couponCode} applied
                <button type="button" className="text-muted underline hover:text-foreground" onClick={() => setCoupon(null)}>Remove</button>
              </p>
            )}
            {data?.totals.couponError && <p role="alert" className="text-xs text-danger">{data.totals.couponError}</p>}
          </form>

          {data ? <OrderTotals totals={data.totals} /> : isLoading ? <Skeleton className="h-28 w-full" /> : null}

          {hasBlocking && <p role="alert" className="text-xs text-warning">Remove the unavailable items to continue.</p>}
          {!data || hasBlocking ? (
            <Button size="lg" className="w-full" disabled>
              Proceed to checkout
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link href="/checkout">Proceed to checkout</Link>
            </Button>
          )}
          {isFetching && <p className="text-center text-xs text-muted" aria-live="polite">Updating prices…</p>}
        </Card>
      </aside>
    </div>
  );
}
