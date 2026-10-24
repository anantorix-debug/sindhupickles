"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { clearMe } from "@/components/store/layout/me-store";
import { LogOut, MapPin, Package, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { storeApi } from "@/services/store";

const items = [
  { href: "/account", label: "Profile", icon: UserRound, exact: true },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/settings", label: "Settings", icon: Settings },
] as const;

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useMutation({
    mutationFn: storeApi.logout,
    onSuccess: async () => {
      clearMe();
      router.push("/");
      router.refresh();
    },
  });

  return (
    <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2 lg:flex-col lg:gap-1">
        {items.map(({ href, label, icon: Icon, ...rest }) => {
          const active = "exact" in rest ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2.5 whitespace-nowrap rounded-md px-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                  active ? "bg-accent-soft font-bold text-accent" : "text-foreground/80 hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <Icon className="size-[18px]" aria-hidden /> {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-md px-4 text-[15px] font-medium text-danger transition-colors hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <LogOut className="size-[18px]" aria-hidden /> Sign out
          </button>
        </li>
      </ul>
    </nav>
  );
}
