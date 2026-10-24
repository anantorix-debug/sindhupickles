"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNav, isActivePath } from "@/config/admin-nav";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {adminNav.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{group.label}</p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                    collapsed && "justify-center px-0",
                    active ? "bg-accent-soft font-bold text-accent" : "text-foreground/80 hover:bg-surface-raised hover:text-foreground",
                  )}
                >
                  <item.icon className="size-[18px] shrink-0" aria-hidden />
                  <span className={cn(collapsed && "sr-only")}>{item.title}</span>
                </Link>
              );
              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
