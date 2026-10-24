import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/store/common/section-heading";
import { siteImages } from "@/config/store-images";

export function WhyUs() {
  return (
    <section aria-labelledby="why-title">
      <PageContainer className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[540px_1fr] lg:gap-16 lg:py-[100px]">
        <div className="relative aspect-[540/400] w-full overflow-hidden rounded-3xl bg-surface">
          <Image src={siteImages.whyUs} alt="Hands blending whole spices in a wooden bowl" fill sizes="(min-width:1024px) 540px, 100vw" className="object-cover" />
        </div>
        <div className="space-y-6">
          <h2 id="why-title" className="font-display text-3xl font-black leading-tight sm:text-4xl lg:text-[42px] lg:leading-[1.2]">
            Why Sindhu&apos;s Pickles? We Make the Best Non-Veg Pickles
          </h2>
          <p className="leading-relaxed text-muted">
            We are obsessed with bringing the taste of homestyle Indian kitchens back to modern dining tables. Every jar of Sindhu&apos;s Pickles is prepared in small batches, ensuring individual attention to meat tenderness and spice infusion. We don&apos;t believe in bulk chemical preserving; we believe in the natural preserving power of pure cold-pressed oils and high-quality spices.
          </p>
          <Button asChild size="lg">
            <Link href="/about">
              Learn Our Full Journey <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </PageContainer>
    </section>
  );
}
