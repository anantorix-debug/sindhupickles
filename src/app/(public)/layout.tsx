import { AnnouncementBar } from "@/components/store/layout/announcement-bar";
import { StoreFooter } from "@/components/store/layout/store-footer";
import { StoreHeader } from "@/components/store/layout/store-header";
import { getSettings } from "@/server/repositories/settings";

/**
 * Customer-facing site. Everything here reads the same database/API as the admin panel; the
 * admin lives under /admin and shares nothing with this tree except UI primitives and types.
 */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const business = await getSettings();
  return (
    <>
      <a href="#main" className="sr-only z-[60] rounded-md bg-primary px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <AnnouncementBar />
      <StoreHeader tagline={business.tagline} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <StoreFooter business={business} />
    </>
  );
}
