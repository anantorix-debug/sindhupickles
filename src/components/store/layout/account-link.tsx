"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { useMe } from "@/components/store/layout/me-store";

/** Shows "Login" or the customer's first name. Fetched client-side so pages stay cacheable. */
export function AccountLink() {
  const me = useMe();
  return (
    <Link
      href={me ? "/account" : "/login"}
      className="flex items-center gap-2 rounded-md px-2 py-2 text-[15px] font-medium text-foreground hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
    >
      <UserRound className="size-[18px]" aria-hidden />
      <span className="hidden xl:inline">{me ? me.name.split(" ")[0] : "Login"}</span>
      <span className="sr-only xl:hidden">{me ? "My account" : "Login"}</span>
    </Link>
  );
}
