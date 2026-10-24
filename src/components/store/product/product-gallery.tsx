"use client";

import * as React from "react";
import Image from "next/image";
import { ProductImage } from "@/components/store/common/product-image";
import { cn } from "@/lib/utils";

/** Main image with thumbnails. The first image is preloaded; the rest load lazily. */
export function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [active, setActive] = React.useState(0);
  const current = images[active];

  return (
    <div className="space-y-3">
      <div className="relative aspect-[7/5] w-full overflow-hidden rounded-lg border border-border bg-surface sm:aspect-[4/3]">
        <ProductImage src={current?.url ?? null} alt={current?.alt || name} sizes="(min-width:1024px) 600px, 100vw" priority={active === 0} />
      </div>
      {images.length > 1 && (
        <ul className="grid grid-cols-5 gap-2 sm:gap-3" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === active}
                className={cn("relative block aspect-square w-full overflow-hidden rounded-md border-2 bg-surface", i === active ? "border-primary" : "border-border hover:border-muted")}
              >
                <Image src={img.url} alt="" fill sizes="100px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
