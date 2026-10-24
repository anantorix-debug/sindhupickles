"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { MapPin, ShoppingBag, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { FormError } from "@/components/ui/form-feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { OrderTotals } from "@/components/store/cart/order-summary";
import { cartActions, setCoupon } from "@/components/store/cart/cart-store";
import { usePricedCart } from "@/components/store/cart/use-priced-cart";
import { StateMessage } from "@/components/store/common/state-message";
import { AddressFields, emptyAddress } from "@/components/store/forms/address-fields";
import { formatAddress } from "@/components/store/account/address-manager";
import { formatCurrency } from "@/lib/format";
import { addressSchema, type AddressFormValues, type AddressInput } from "@/lib/validation/store";
import { cn } from "@/lib/utils";
import { ApiRequestError } from "@/services/api-client";
import { storeApi } from "@/services/store";
import { payOrder } from "@/components/store/checkout/razorpay-client";
import type { Address } from "@/types";
import type { PaymentOption } from "@/types/store";

interface CheckoutViewProps {
  addresses: Address[];
  paymentOptions: PaymentOption[];
  defaultName: string;
  defaultPhone: string;
}

/**
 * Cart → Address → Payment → Review → Place order. The browser sends only *what* is being bought
 * and *where*; the server recomputes every price, the shipping, the discount and the total.
 */
export function CheckoutView({ addresses, paymentOptions, defaultName, defaultPhone }: CheckoutViewProps) {
  const router = useRouter();
  const { cart, data, isLoading, isError, refetch } = usePricedCart();
  const coupon = data?.totals.couponCode ?? undefined;

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [addressChoice, setAddressChoice] = React.useState<string>(defaultAddress?.id ?? "new");
  const [payment, setPayment] = React.useState<PaymentOption["id"] | "">(paymentOptions[0]?.id ?? "");
  const [note, setNote] = React.useState("");
  const [saveAsDefault, setSaveAsDefault] = React.useState(false);
  const [payNote, setPayNote] = React.useState<string | null>(null);

  const { register, handleSubmit, setError, trigger, getValues, formState: { errors } } = useForm<AddressFormValues, unknown, AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: { ...emptyAddress, fullName: defaultName, phone: defaultPhone },
  });

  // An online order only counts as placed once Razorpay confirms the payment. Until then the cart is kept,
  // and the unpaid record on the server (it holds the stock) is hidden from "My orders" and from Admin.
  const [paying, setPaying] = React.useState(false);
  const [redirecting, setRedirecting] = React.useState(false);
  const [payError, setPayError] = React.useState<string | null>(null);
  const draft = React.useRef<{ key: string; orderId: string } | null>(null);
  const draftKey = React.useRef("");

  function finish(orderId: string, query: string) {
    setRedirecting(true);
    cartActions.clear();
    setCoupon(null);
    router.push(`/account/orders/${orderId}?${query}`);
    router.refresh();
  }

  async function takePayment(orderId: string) {
    setPayError(null);
    setPaying(true);
    setPayNote("Opening secure payment…");
    try {
      const { result, message } = await payOrder(orderId);
      if (result === "paid") return finish(orderId, "placed=1");
      // Money may have moved but the server hasn't confirmed yet: show the order page, which keeps checking.
      if (result === "pending" || result === "review") return finish(orderId, `payment=${result}`);
      setPayError(
        result === "dismissed"
          ? "Payment wasn't completed, so no order has been placed. Your cart is saved. Press Pay to try again."
          : `${message ?? "The payment didn't go through."} No order has been placed and you haven't been charged. Press Pay to try again.`,
      );
    } catch (e) {
      setPayError(`${e instanceof Error ? e.message : "We couldn't open the payment window."} No order has been placed. Press Pay to try again.`);
    }
    setPayNote(null);
    setPaying(false);
  }

  const place = useMutation({
    mutationFn: (newAddress?: AddressInput) =>
      storeApi.checkout({
        items: cart.items.map((e) => ({ variantId: e.variantId, quantity: e.quantity })),
        ...(newAddress ? { newAddress: { ...newAddress, isDefault: saveAsDefault || addresses.length === 0 } } : { addressId: addressChoice }),
        paymentMethod: payment,
        couponCode: coupon,
        note: note.trim() || undefined,
      }),
    onSuccess: async (order) => {
      if (payment !== "razorpay") return finish(order.orderId, "placed=1"); // COD / test payment: placed immediately
      draft.current = { key: draftKey.current, orderId: order.orderId };
      await takePayment(order.orderId);
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.status === 409) refetch(); // cart changed under us — show fresh data
      if (err instanceof ApiRequestError && err.fields) for (const [k, message] of Object.entries(err.fields)) setError(k as keyof AddressFormValues, { message });
    },
  });

  if (cart.items.length === 0 && !redirecting) {
    return (
      <StateMessage icon={ShoppingBag} title="Your cart is empty" description="Add a few pickles before checking out." action={<Button asChild size="lg"><Link href="/shop">Continue shopping</Link></Button>} />
    );
  }
  if (isError) {
    return <StateMessage icon={TriangleAlert} title="We couldn't prepare your checkout" description="Please check your connection and try again." action={<Button onClick={() => refetch()}>Try again</Button>} />;
  }

  const blocking = data?.lines.some((l) => l.issue === "unavailable" || l.issue === "out_of_stock" || l.issue === "reduced") ?? false;
  const ready = Boolean(data) && !blocking && Boolean(payment) && cart.items.length > 0;

  async function onPlace() {
    const newAddress = addressChoice === "new" ? (await trigger()) && addressSchema.parse(getValues()) : undefined;
    if (newAddress === false) return;
    // Same cart, address, coupon, method and note as the payment that was just abandoned: reuse that pending
    // record instead of holding stock again for a second one.
    draftKey.current = JSON.stringify({ items: cart.items.map((e) => [e.variantId, e.quantity]), addressChoice, newAddress, payment, coupon, note: note.trim() });
    if (payment === "razorpay" && draft.current?.key === draftKey.current) return void takePayment(draft.current.orderId);
    setPayError(null);
    place.mutate(newAddress || undefined);
  }

  return (
    <form
      onSubmit={handleSubmit(() => undefined)}
      noValidate
      className="grid gap-8 lg:grid-cols-[1fr_400px]"
      aria-busy={place.isPending}
    >
      <div className="space-y-6">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><MapPin className="size-5 text-accent" aria-hidden /> Delivery address</h2>
          <fieldset className="space-y-3">
            <legend className="sr-only">Choose a delivery address</legend>
            {addresses.map((a) => (
              <label key={a.id} className={cn("flex cursor-pointer gap-3 rounded-md border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", addressChoice === a.id ? "border-primary bg-accent-soft/40" : "border-border hover:border-muted")}>
                <input type="radio" name="address" value={a.id} checked={addressChoice === a.id} onChange={() => setAddressChoice(a.id)} className="mt-1 accent-[var(--primary)]" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="flex items-center gap-2 font-semibold">{a.label} {a.isDefault && <StatusBadge label="Default" tone="primary" />}</span>
                  <span className="block font-medium">{a.fullName} · {a.phone}</span>
                  <span className="block text-muted">{formatAddress(a)}</span>
                </span>
              </label>
            ))}
            <label className={cn("flex cursor-pointer items-center gap-3 rounded-md border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", addressChoice === "new" ? "border-primary bg-accent-soft/40" : "border-border hover:border-muted")}>
              <input type="radio" name="address" value="new" checked={addressChoice === "new"} onChange={() => setAddressChoice("new")} className="accent-[var(--primary)]" />
              <span className="text-sm font-semibold">Add a new address</span>
            </label>
          </fieldset>

          {addressChoice === "new" && (
            <div className="mt-5 space-y-4 border-t border-border pt-5">
              <AddressFields register={register} errors={errors} idPrefix="checkout" />
              {addresses.length > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="checkout-default" className="text-sm font-semibold">Save as my default address</label>
                  <Switch id="checkout-default" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} />
                </div>
              )}
              <p className="text-xs text-muted">This address is saved to your account.</p>
            </div>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 font-display text-xl font-bold">Payment method</h2>
          {paymentOptions.length === 0 ? (
            <p className="text-sm text-danger">No payment methods are available right now. Please try again later.</p>
          ) : (
            <fieldset className="space-y-3">
              <legend className="sr-only">Choose a payment method</legend>
              {paymentOptions.map((p) => (
                <label key={p.id} className={cn("flex cursor-pointer gap-3 rounded-md border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", payment === p.id ? "border-primary bg-accent-soft/40" : "border-border hover:border-muted")}>
                  <input type="radio" name="payment" value={p.id} checked={payment === p.id} onChange={() => setPayment(p.id)} className="mt-1 accent-[var(--primary)]" />
                  <span className="text-sm"><span className="block font-semibold">{p.label}</span><span className="text-muted">{p.description}</span></span>
                </label>
              ))}
            </fieldset>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <label htmlFor="note" className="mb-2 block font-display text-xl font-bold">Order note <span className="text-sm font-normal text-muted">(optional)</span></label>
          <Textarea id="note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything we should know about delivery?" />
        </Card>
      </div>

      <aside aria-label="Order summary">
        <Card className="space-y-5 p-5 sm:p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-xl font-bold">Order summary</h2>
          {isLoading || !data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <ul className="divide-y divide-border text-sm">
                {data.lines.map((l) => (
                  <li key={l.variantId} className="flex justify-between gap-3 py-3 first:pt-0">
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-semibold">{l.name}</p>
                      <p className="text-xs text-muted">{l.variantLabel} · Qty {l.quantity}</p>
                      {l.issue && <p role="alert" className="mt-1 text-xs font-semibold text-warning">{l.issue === "reduced" ? `Only ${l.available} left` : "Unavailable"}</p>}
                    </div>
                    <p className="shrink-0 font-semibold">{l.issue === "unavailable" || l.issue === "out_of_stock" ? "—" : formatCurrency(l.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <OrderTotals totals={data.totals} />
            </>
          )}

          {blocking && (
            <p role="alert" className="text-sm text-warning">
              Some items changed. <Link href="/cart" className="font-semibold underline">Review your cart</Link> before placing the order.
            </p>
          )}
          {place.isError && !(place.error instanceof ApiRequestError && place.error.fields && !place.error.fields.addressId) && (
            <FormError>{place.error.message}</FormError>
          )}
          {payError && <FormError>{payError}</FormError>}
          <Button type="button" size="lg" className="w-full" disabled={!ready} loading={place.isPending || paying || redirecting} onClick={onPlace}>
            {payNote ?? (data ? `${payment === "razorpay" ? "Pay" : "Place order"} · ${formatCurrency(data.totals.total)}` : "Place order")}
          </Button>
          <p className="text-center text-xs text-muted">By placing your order you agree to our <Link href="/policies/terms" className="underline">Terms</Link> and <Link href="/policies/shipping-return-refund" className="underline">Shipping, Return &amp; Refund policy</Link>.</p>
        </Card>
      </aside>
    </form>
  );
}
