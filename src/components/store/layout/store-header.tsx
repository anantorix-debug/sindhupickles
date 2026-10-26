import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { AccountLink } from "@/components/store/layout/account-link";
import { CartLink } from "@/components/store/layout/cart-link";
import { MobileNavButton, MobileSearchButton } from "@/components/store/layout/mobile-menu";
import { SearchBox } from "@/components/store/layout/search-box";
import { mainNav } from "@/config/store-nav";

/**
 * Server-rendered shell with small client islands (search, account, cart, mobile menu).
 * Desktop: logo · nav · search · account · cart.   Mobile: menu · logo · search · cart.
 * (1024–1279px: the search box becomes a search button so the row fits.)
 */
export function StoreHeader({ tagline }: { tagline: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-3 sm:px-8 lg:h-[90px] lg:gap-8 lg:px-20">
        <div className="lg:hidden">
          <MobileNavButton />
        </div>

        <Link href="/" aria-label="Sindhu's Pickles home" className="shrink-0 focus-visible:outline-2 focus-visible:outline-accent">
          {/* On the smallest phones only the round mark shows; the wordmark appears from 400px up. */}
          <BrandLogo subtitle={tagline} className="[&>div:last-child]:hidden min-[400px]:[&>div:last-child]:block" />
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center justify-center gap-8 lg:flex">
          {mainNav.map((l) => (
            <Link key={l.href} href={l.href} className="text-[15px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-3 lg:ml-0">
          {/* Below 1280px the full search box doesn't fit beside the menu, so the search button is used instead. */}
          <SearchBox className="hidden w-64 xl:block" />
          <div className="xl:hidden">
            <MobileSearchButton />
          </div>
          <div className="hidden lg:block">
            <AccountLink />
          </div>
          <CartLink />
        </div>
      </div>
    </header>
  );
}
