"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
}

export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${label}`}
        className="inline-flex size-8 items-center justify-center rounded-sm text-muted hover:bg-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((a) =>
          a.href ? (
            <DropdownMenuItem key={a.label} asChild>
              <Link href={a.href}>
                {a.icon}
                {a.label}
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={a.label} destructive={a.destructive} onSelect={a.onSelect}>
              {a.icon}
              {a.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
