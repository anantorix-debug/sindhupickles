import type { Metadata } from "next";
import { siteKeywords } from "@/content/legacy-seo";
import { BrandStory } from "@/components/store/home/brand-story";
import { CategoryTiles } from "@/components/store/home/category-tiles";
import { CtaBand } from "@/components/store/home/cta-band";
import { Hero } from "@/components/store/home/hero";
import { ProductSection } from "@/components/store/home/product-section";
import { ReviewsSection } from "@/components/store/home/reviews-section";
import { WhyUs } from "@/components/store/home/why-us";
import { getBestSellers, getLatestReviews, getPublicBusiness, listCategories, listProducts } from "@/server/store/catalog";


export const metadata: Metadata = {
  alternates: { canonical: "/" },
  keywords: siteKeywords,
  openGraph: { title: "Sindhu's Pickles — Authentic Homemade Non-Veg Pickles", url: "/", images: ["/assets/images/hero.webp"] },
};

export default async function HomePage() {
  const [business, categories, showcase, bestSellers, reviews] = await Promise.all([
    getPublicBusiness(),
    listCategories(),
    // Products flagged "featured" in Admin come first; the rest fill the grid.
    listProducts({ sort: "featured", pageSize: 8 }).then((r) => r.items),
    getBestSellers(4),
    getLatestReviews(3),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: business.name,
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    logo: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/assets/images/logo.png`,
    email: business.email,
    telephone: business.phone,
    address: business.address,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero couponCode={business.welcomeCoupon} couponPct={business.welcomeCouponPct} />
      <CategoryTiles categories={categories} />
      <ProductSection
        id="featured-title"
        title="Explore Our Authentic Pickles"
        description="Fresh batches prepared weekly using classic recipes and wholesome ingredients."
        products={showcase}
        cta={{ href: "/shop", label: "View All Products" }}
        priority
      />
      <BrandStory />
      <ProductSection id="best-title" eyebrow="Our top choice" title="Best Selling Pickles" description="The absolute favorites loved by our community for their rich, fiery punch." products={bestSellers} />
      <WhyUs />
      <ReviewsSection reviews={reviews} />
      <CtaBand />
    </>
  );
}
