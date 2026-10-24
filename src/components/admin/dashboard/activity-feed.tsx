import { CreditCard, PackageX, ShoppingBag, UserPlus, type LucideIcon } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ActivityItem } from "@/types";

const icons: Record<ActivityItem["kind"], LucideIcon> = {
  order: ShoppingBag,
  customer: UserPlus,
  stock: PackageX,
  payment: CreditCard,
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="space-y-4">
      {items.map((a) => {
        const Icon = icons[a.kind];
        return (
          <li key={a.id} className="flex gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 text-sm">
              <p>{a.message}</p>
              <p className="mt-0.5 text-xs text-muted">{formatDateTime(a.at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
