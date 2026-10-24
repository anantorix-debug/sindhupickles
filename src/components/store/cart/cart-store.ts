"use client";

import { useSyncExternalStore } from "react";

/**
 * The one cart. State lives in localStorage (so it survives reloads and is shared across tabs)
 * and is exposed through `useCart`. It stores only *what the customer picked* plus a display
 * snapshot for instant rendering — real prices and stock always come from the server
 * (`/api/store/cart/validate`), never from here.
 */
export interface CartSnapshot {
  slug: string;
  name: string;
  variantLabel: string;
  price: number;
  imageUrl: string | null;
}

export interface CartEntry {
  variantId: string;
  quantity: number;
  snapshot: CartSnapshot;
}

const KEY = "sindhu.cart.v1";
const MAX_QTY = 20;
const EMPTY: CartEntry[] = [];

let cache: { raw: string | null; items: CartEntry[] } = { raw: null, items: EMPTY };
const listeners = new Set<() => void>();

function read(): CartEntry[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache.items; // storage unavailable: fall back to the in-memory copy
  }
  if (raw === cache.raw) return cache.items;
  let items = EMPTY;
  try {
    const parsed = raw ? (JSON.parse(raw) as CartEntry[]) : [];
    items = parsed.filter((e) => e && typeof e.variantId === "string" && Number.isInteger(e.quantity) && e.quantity > 0);
  } catch {
    items = EMPTY;
  }
  cache = { raw, items: items.length ? items : EMPTY };
  return cache.items;
}

function write(items: CartEntry[]) {
  const raw = items.length ? JSON.stringify(items) : null;
  cache = { raw, items: items.length ? items : EMPTY };
  try {
    if (raw) localStorage.setItem(KEY, raw);
    else localStorage.removeItem(KEY);
  } catch {
    /* keep in-memory only */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export const cartActions = {
  add(variantId: string, snapshot: CartSnapshot, quantity = 1) {
    const items = [...read()];
    const i = items.findIndex((e) => e.variantId === variantId);
    if (i >= 0) items[i] = { ...items[i], snapshot, quantity: Math.min(items[i].quantity + quantity, MAX_QTY) };
    else items.push({ variantId, quantity: Math.min(quantity, MAX_QTY), snapshot });
    write(items);
  },
  setQuantity(variantId: string, quantity: number) {
    if (quantity <= 0) return cartActions.remove(variantId);
    write(read().map((e) => (e.variantId === variantId ? { ...e, quantity: Math.min(quantity, MAX_QTY) } : e)));
  },
  remove(variantId: string) {
    write(read().filter((e) => e.variantId !== variantId));
  },
  clear() {
    write([]);
  },
};

export const MAX_CART_QTY = MAX_QTY;

export function useCart() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    items,
    count: items.reduce((n, e) => n + e.quantity, 0),
    /** Approximate (uses add-time prices) — only for the header badge. The cart page shows server prices. */
    approxSubtotal: items.reduce((s, e) => s + e.snapshot.price * e.quantity, 0),
    ...cartActions,
  };
}

// ---- coupon: remembered with the cart so cart and checkout agree (validated server-side every time) ----
const COUPON_KEY = "sindhu.coupon.v1";
const couponListeners = new Set<() => void>();
let couponMemory: string | null = null;

function readCoupon(): string | null {
  try {
    return localStorage.getItem(COUPON_KEY) ?? couponMemory;
  } catch {
    return couponMemory;
  }
}

export function setCoupon(code: string | null) {
  couponMemory = code;
  try {
    if (code) localStorage.setItem(COUPON_KEY, code);
    else localStorage.removeItem(COUPON_KEY);
  } catch {
    /* in-memory only */
  }
  couponListeners.forEach((l) => l());
}

function subscribeCoupon(cb: () => void) {
  couponListeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === COUPON_KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    couponListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCoupon(): string | null {
  return useSyncExternalStore(subscribeCoupon, readCoupon, () => null);
}
