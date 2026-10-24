"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

// The dialog code loads the first time a button is tapped, keeping the initial JS small.
const NavDrawer = dynamic(() => import("@/components/store/layout/mobile-drawers").then((m) => m.NavDrawer), { ssr: false });
const SearchSheet = dynamic(() => import("@/components/store/layout/mobile-drawers").then((m) => m.SearchSheet), { ssr: false });

/** Left side of the mobile header: opens the navigation drawer. */
export function MobileNavButton() {
  const [open, setOpen] = React.useState(false);
  const [used, setUsed] = React.useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open menu"
        onClick={() => {
          setUsed(true);
          setOpen(true);
        }}
      >
        <Menu className="size-5" aria-hidden />
      </Button>
      {used && <NavDrawer open={open} onOpenChange={setOpen} />}
    </>
  );
}

/** Right side of the mobile header: opens a search sheet. */
export function MobileSearchButton() {
  const [open, setOpen] = React.useState(false);
  const [used, setUsed] = React.useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Search"
        onClick={() => {
          setUsed(true);
          setOpen(true);
        }}
      >
        <Search className="size-5" aria-hidden />
      </Button>
      {used && <SearchSheet open={open} onOpenChange={setOpen} />}
    </>
  );
}
