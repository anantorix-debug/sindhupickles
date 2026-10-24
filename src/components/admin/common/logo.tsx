import { BrandLogo } from "@/components/brand/logo";

export function Logo({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return <BrandLogo subtitle="Admin Console" compact={collapsed} className={className} />;
}
