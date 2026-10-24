import type { Metadata } from "next";
import { BrandStory } from "@/components/store/home/brand-story";
import { CtaBand } from "@/components/store/home/cta-band";
import { WhyUs } from "@/components/store/home/why-us";
import { getPublicBusiness } from "@/server/store/catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Our Story",
  description: "How Sindhu's Pickles makes homemade non-veg pickles in small batches with cold-pressed gingelly oil and freshly ground spices.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const b = await getPublicBusiness();
  return (
    <>
      <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
        <h1 className="font-display text-4xl font-black sm:text-5xl">Our Story</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          {b.name} began in a home kitchen, with recipes passed down through generations. Today every jar is still made the same way — in small batches, with fresh meat and seafood, cold-pressed gingelly oil and spices ground the same day.
        </p>
      </section>
      <BrandStory />
      <WhyUs />
      <CtaBand />
    </>
  );
}
