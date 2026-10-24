"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings, UserRound } from "lucide-react";
import { titleForPath } from "@/config/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/admin/sidebar/sidebar-user";
import { formatDateTime } from "@/lib/format";
import { signOut } from "@/services/auth";
import type { ActivityItem, AdminUser } from "@/types";

interface AdminHeaderProps {
  user: AdminUser;
  notifications: ActivityItem[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobileNav: () => void;
}

export function AdminHeader({ user, notifications, collapsed, onToggleCollapse, onOpenMobileNav }: AdminHeaderProps) {
  const title = titleForPath(usePathname());
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-height)] items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
        <Menu className="size-5" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
      </Button>

      <p className="truncate font-display text-lg font-bold lg:hidden">{title}</p>

      <form role="search" action="/admin/orders" className="relative ml-2 hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input name="q" type="search" aria-label="Search orders" placeholder="Search orders…" className="rounded-pill pl-9" />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Notifications (${notifications.length})`}
            className="relative inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Bell className="size-5" aria-hidden />
            {notifications.length > 0 && <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-primary" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            {notifications.length === 0 && <p className="px-2.5 py-6 text-center text-sm text-muted">You&apos;re all caught up.</p>}
            {notifications.map((n) => (
              <div key={n.id} className="rounded-sm px-2.5 py-2 text-sm">
                <p>{n.message}</p>
                <p className="mt-0.5 text-xs text-muted">{formatDateTime(n.at)}</p>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account menu"
            className="flex items-center gap-2 rounded-md p-1.5 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-accent"
          >
            <UserAvatar name={user.name} />
            <span className="hidden text-left text-sm font-semibold sm:block">{user.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/settings">
                <UserRound /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onSelect={async () => {
                await signOut().catch(() => undefined);
                router.push("/admin/login");
                router.refresh();
              }}
            >
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
