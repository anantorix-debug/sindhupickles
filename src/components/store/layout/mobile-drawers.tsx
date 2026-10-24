"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BrandLogo } from "@/components/brand/logo";
import { SearchBox } from "@/components/store/layout/search-box";
import { mainNav } from "@/config/store-nav";

/** Loaded on first tap only (see mobile-menu.tsx), so the dialog library isn't in the initial bundle. */
export function NavDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="left" className="flex flex-col p-0">
        <DialogTitle className="sr-only">Menu</DialogTitle>
        <DialogDescription className="sr-only">Site navigation</DialogDescription>
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <BrandLogo subtitle="Premium Homemade Non-Veg" />
          <DialogClose aria-label="Close menu" className="rounded-sm p-1.5 text-muted hover:text-foreground">
            <X className="size-5" aria-hidden />
          </DialogClose>
        </div>
        <nav aria-label="Mobile" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {[...mainNav, { label: "My Account", href: "/account" }, { label: "Cart", href: "/cart" }].map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => onOpenChange(false)} className="flex h-12 items-center rounded-md px-3 text-base font-medium hover:bg-surface-raised hover:text-accent">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </DialogContent>
    </Dialog>
  );
}

export function SearchSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-24 max-w-md -translate-y-0 p-4">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Search products</DialogDescription>
        <SearchBox autoFocus onNavigate={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
