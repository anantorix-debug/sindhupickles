import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer, SectionHeading } from "@/components/store/common/section-heading";
import { ProductCard } from "@/components/store/common/product-card";
import type { StoreProductCard } from "@/types/store";

interface ProductSectionProps {
  id: string;
  title: string;
  description: string;
  eyebrow?: string;
  products: StoreProductCard[];
  cta?: { href: string; label: string };
  /** Mark the first row's images as high priority for LCP. */
  priority?: boolean;
}

export function ProductGrid({ products, priority = false, headingLevel = 3 }: { products: StoreProductCard[]; priority?: boolean; headingLevel?: 2 | 3 }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 xl:grid-cols-4 xl:gap-8">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={priority && i < 4} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}

export function ProductSection({ id, title, description, eyebrow, products, cta, priority }: ProductSectionProps) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={id}>
      <PageContainer className="space-y-10 py-12 sm:py-16 lg:space-y-12 lg:py-20">
        <div id={id}>
          <SectionHeading title={title} description={description} eyebrow={eyebrow} />
        </div>
        <ProductGrid products={products} priority={priority} />
        {cta && (
          <div className="flex justify-center">
            <Button asChild size="lg">
              <Link href={cta.href}>
                {cta.label} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        )}
      </PageContainer>
    </section>
  );
}
