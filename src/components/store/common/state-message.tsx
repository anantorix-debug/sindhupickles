import type { LucideIcon } from "lucide-react";
import { PackageSearch } from "lucide-react";
import { cn } from "@/lib/utils";

/** Empty / informational state for storefront pages. */
export function StateMessage({ title, description, action, icon: Icon = PackageSearch, className }: { title: string; description?: string; action?: React.ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-16 text-center", className)}>
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="size-7" aria-hidden />
      </span>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      {description && <p className="mt-2 max-w-md text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
