import Image from "next/image";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}

/** Product photo with a branded placeholder when the product has no (servable) image yet. */
export function ProductImage({ src, alt, sizes, priority, className }: ProductImageProps) {
  if (!src) {
    return (
      <div role="img" aria-label={`${alt} (photo coming soon)`} className={cn("flex size-full items-center justify-center bg-surface-raised", className)}>
        <Image src="/assets/images/logo.webp" alt="" width={490} height={640} sizes="80px" className="h-16 w-auto opacity-90" />
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={cn("object-cover", className)} />;
}
