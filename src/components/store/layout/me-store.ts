"use client";

import { useEffect, useSyncExternalStore } from "react";
import { storeApi } from "@/services/store";

/**
 * Who is signed in, for the header. A tiny external store (instead of a query library) so the
 * always-loaded header adds almost no JavaScript. `undefined` = not loaded yet.
 */
export type Me = { id: string; name: string } | null;

let state: Me | undefined;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

/** Re-reads the session. Call after sign-in, sign-out or a name change. */
export function refreshMe(): Promise<void> {
  inflight ??= storeApi
    .me()
    .catch(() => null)
    .then((me) => {
      state = me;
      emit();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function clearMe() {
  state = null;
  emit();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

export function useMe(): Me | undefined {
  const me = useSyncExternalStore(subscribe, () => state, () => undefined);
  useEffect(() => {
    if (state === undefined) void refreshMe();
  }, []);
  return me;
}
