import { initials } from "@/lib/format";
import type { AdminUser } from "@/types";
import { cn } from "@/lib/utils";

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent", className)}
    >
      {initials(name)}
    </span>
  );
}

export function SidebarUser({ user, collapsed }: { user: AdminUser; collapsed?: boolean }) {
  return (
    <div className="border-t border-border p-3">
      <div className={cn("flex items-center gap-3 rounded-md p-2", collapsed && "justify-center")}>
        <UserAvatar name={user.name} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs capitalize text-muted">{user.role}</p>
          </div>
        )}
      </div>
    </div>
  );
}
