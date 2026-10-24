import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  subtitle: string;
  /** Show only the badge, without the wordmark. */
  compact?: boolean;
  className?: string;
}

/** Brand mark: the Sindhu's Pickles badge + serif wordmark. Shared by the storefront and the admin. */
export function BrandLogo({ subtitle, compact = false, className }: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* The badge already contains the name, so the image is decorative next to the wordmark and labelled when alone. */}
      <Image
        src="/assets/images/logo.webp"
        alt={compact ? "Sindhu's Pickles" : ""}
        width={490}
        height={640}
        sizes="48px"
        priority
        className="h-11 w-auto shrink-0 lg:h-14"
      />
      {!compact && (
        <div className="min-w-0 leading-none">
          <p className="truncate font-display text-[22px] font-black text-accent">Sindhu&apos;s Pickles</p>
          <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.06em] text-muted">{subtitle}</p>
        </div>
      )}
    </div>
  );
}
