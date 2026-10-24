import Image from "next/image";
import { Check, Heart, Home, Truck } from "lucide-react";
import { PageContainer } from "@/components/store/common/section-heading";
import { siteImages } from "@/config/store-images";

const bullets = [
  "100% Homemade with strictly zero artificial flavors",
  "Fresh meat and seafood sourced daily with zero cold-storage",
  "Slow-cooked carefully to retain nutritional value and juice tenderness",
  "Made with pure, aromatic cold-pressed gingelly oil",
  "Absolutely no palm oil or added chemical coloring",
];

const badges = [
  { Icon: Truck, title: "Delivery in 5-7 days", text: "Express fresh delivery across India" },
  { Icon: Heart, title: "Free from palm oil", text: "Using only pure gingelly oil" },
  { Icon: Home, title: "Doorstep Delivery", text: "Safely sealed in break-proof jars" },
];

export function BrandStory() {
  return (
    <section aria-labelledby="story-title" className="bg-section-warm">
      <PageContainer className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1fr_480px] lg:gap-16 lg:py-[100px]">
        <div className="reveal space-y-6">
          <p className="text-sm font-bold uppercase tracking-[0.06em] text-accent">The Pure Taste of Tradition</p>
          <h2 id="story-title" className="font-display text-3xl font-black leading-tight sm:text-4xl lg:text-[44px]">
            Homemade Pickles Crafted with Generational Recipes
          </h2>
          <ul className="space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <Check className="mt-1 size-[18px] shrink-0 text-accent" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <ul className="grid gap-5 pt-4 sm:grid-cols-3">
            {badges.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-bold">{title}</span>
                  <span className="block text-xs text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="reveal hover-lift relative mx-auto aspect-[4/3] w-full max-w-[480px] overflow-hidden rounded-3xl border border-border bg-surface">
          <Image src={siteImages.brandStory} alt="Sindhu's Pickles jars — chicken, mutton, fish and prawn — with whole spices" fill sizes="(min-width:1024px) 480px, 100vw" className="object-cover" />
        </div>
      </PageContainer>
    </section>
  );
}
