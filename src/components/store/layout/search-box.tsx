"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { storeApi } from "@/services/store";
import type { StoreProductCard } from "@/types/store";

/** Search with live product suggestions from the API; Enter goes to the full results on /shop. */
export function SearchBox({ className, autoFocus, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<{ term: string; items: StoreProductCard[] } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const term = q.trim();

  // Debounced lookup; a newer keystroke cancels the previous request.
  React.useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await storeApi.suggestions(term);
        if (!cancelled) setResults({ term, items });
      } catch {
        if (!cancelled) setResults({ term, items: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term]);

  React.useEffect(() => {
    const close = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!term) return;
    setOpen(false);
    onNavigate?.();
    router.push(`/shop?q=${encodeURIComponent(term)}`);
  }

  const showList = open && term.length >= 2;
  const items = results?.term === term ? results.items : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <form role="search" onSubmit={submit}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search pickles…"
          role="combobox"
          aria-autocomplete="list"
          aria-label="Search products"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          className="h-10 w-full rounded-pill border border-border bg-surface pl-10 pr-9 text-sm text-foreground placeholder:text-muted/70 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary/40 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none"
        />
        {q && (
          <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-foreground">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </form>

      {showList && (
        <div id={listId} className="absolute inset-x-0 top-12 z-50 overflow-hidden rounded-lg border border-border bg-surface-raised shadow-pop">
          {!items || items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">{loading || !items ? "Searching…" : `No pickles found for “${term}”`}</p>
          ) : (
            <ul>
              {items.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/product/${p.slug}`}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-border"
                  >
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-surface">
                      {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="44px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="text-xs text-muted">{p.category}</span>
                    </span>
                    <span className="text-sm font-bold">{formatCurrency(p.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/shop?q=${encodeURIComponent(term)}`}
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="block border-t border-border px-4 py-2.5 text-center text-sm font-semibold text-accent hover:bg-border"
          >
            See all results
          </Link>
        </div>
      )}
    </div>
  );
}
