import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon, YoutubeIcon } from "@/components/brand/social-icons";
import { footerPolicies, footerQuickLinks } from "@/config/store-nav";
import type { StoreSettings } from "@/types";

type Business = Pick<StoreSettings, "storeName" | "supportEmail" | "supportPhone" | "address" | "instagramUrl" | "facebookUrl" | "youtubeUrl">;

const linkClass = "text-sm text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent";

/** All business details come from Admin → Settings, so editing them there updates the whole site. */
export function StoreFooter({ business }: { business: Business }) {
  const socials = [
    { label: "Instagram", href: business.instagramUrl, Icon: InstagramIcon },
    { label: "Facebook", href: business.facebookUrl, Icon: FacebookIcon },
    { label: "YouTube", href: business.youtubeUrl, Icon: YoutubeIcon },
  ].filter((s) => s.href);

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-14 sm:px-8 lg:px-20 lg:pt-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr] lg:gap-16">
          <div className="space-y-5">
            <p className="font-display text-[28px] font-black">{business.storeName}</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              Premium homemade non-veg pickles prepared in the most hygienic home kitchens of India. Hand-bottled carefully with pure gingelly oil and stone-ground secret spice blends.
            </p>
          </div>

          <nav aria-label="Quick links">
            <p className="mb-4 font-bold">Quick Links</p>
            <ul className="space-y-3">
              {footerQuickLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Policies">
            <p className="mb-4 font-bold">Policies</p>
            <ul className="space-y-3">
              {footerPolicies.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="mb-4 font-bold">Get in Touch</p>
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <address className="not-italic">{business.address}</address>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <a href={`tel:${business.supportPhone.replace(/[^+\d]/g, "")}`} className="hover:text-accent">
                  {business.supportPhone}
                </a>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <a href={`mailto:${business.supportEmail}`} className="break-all hover:text-accent">
                  {business.supportEmail}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">© {new Date().getFullYear()} {business.storeName}. All Rights Reserved. Handmade in Tamil Nadu, India.</p>
          {socials.length > 0 && (
            <ul className="flex gap-4">
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:border-primary hover:text-accent"
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
