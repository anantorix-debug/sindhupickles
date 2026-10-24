import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/store/common/section-heading";
import { siteImages } from "@/config/store-images";

export function Hero({ couponCode, couponPct }: { couponCode: string; couponPct: number }) {
  return (
    <section aria-labelledby="hero-title" className="bg-section-warm">
      <PageContainer className="grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_520px] lg:gap-16 lg:py-20">
        <div className="space-y-6 lg:space-y-7">
          {couponCode && couponPct > 0 && (
            <p className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
              <Percent className="size-3.5" aria-hidden />
              Get flat {couponPct}% off on your first order! Code: {couponCode}
            </p>
          )}
          <h1 id="hero-title" className="font-display text-4xl font-black leading-[1.1] sm:text-5xl lg:text-[56px]">
            Authentic Homemade Non-Veg Pickles Crafted with Love
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Savor the rich, traditional heritage of handmade Indian delicacies. Crafted with premium bone-less cuts, slow-cooked to perfection, and infused with freshly ground cold-pressed spices.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg">
              <Link href="/shop">
                Shop Pure Spice Now <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/about">Explore Our Heritage</Link>
            </Button>
          </div>
        </div>
        <div className="relative aspect-[520/450] w-full overflow-hidden rounded-3xl bg-surface lg:h-[450px]">
          <Image src={siteImages.hero} alt="A jar of homemade non-veg pickle with whole red chillies" fill priority sizes="(min-width:1024px) 520px, 100vw" className="object-cover" />
        </div>
      </PageContainer>
    </section>
  );
}
