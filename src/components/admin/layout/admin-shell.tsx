"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Logo } from "@/components/admin/common/logo";
import { SidebarNav } from "@/components/admin/sidebar/sidebar-nav";
import { SidebarUser } from "@/components/admin/sidebar/sidebar-user";
import { AdminHeader } from "@/components/admin/header/admin-header";
import { cn } from "@/lib/utils";
import type { ActivityItem, AdminUser } from "@/types";

const STORAGE_KEY = "admin.sidebar.collapsed";

// Tiny external store so the persisted sidebar state is read without an effect.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const readCollapsed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // storage unavailable — default to expanded
  }
};
const writeCollapsed = (value: boolean) => {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
};

interface AdminShellProps {
  user: AdminUser;
  notifications: ActivityItem[];
  children: React.ReactNode;
}

export function AdminShell({ user, notifications, children }: AdminShellProps) {
  const collapsed = React.useSyncExternalStore(subscribe, readCollapsed, () => false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const toggleCollapsed = () => writeCollapsed(!collapsed);

  return (
    <TooltipProvider delayDuration={100}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex",
          collapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]",
        )}
      >
        <div className={cn("flex h-[var(--header-height)] items-center border-b border-border px-5", collapsed && "justify-center px-0")}>
          <Logo collapsed={collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} />
        <SidebarUser user={user} collapsed={collapsed} />
      </aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent side="left" className="flex flex-col p-0">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">Admin sections</DialogDescription>
          <div className="flex h-[var(--header-height)] items-center border-b border-border px-5">
            <Logo />
          </div>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
          <SidebarUser user={user} />
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200",
          collapsed ? "lg:pl-[var(--sidebar-width-collapsed)]" : "lg:pl-[var(--sidebar-width)]",
        )}
      >
        <AdminHeader
          user={user}
          notifications={notifications}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
