"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProductImage } from "@/components/store/common/product-image";
import { cn } from "@/lib/utils";

type Img = { url: string; alt: string };

/**
 * Main image with thumbnails. On a mouse/trackpad the photo magnifies under the cursor; clicking (or tapping) it opens a
 * full-screen viewer with click-to-zoom, arrows and keyboard navigation. The first image is preloaded; the rest load lazily.
 */
export function ProductGallery({ images, name }: { images: Img[]; name: string }) {
  const [active, setActive] = React.useState(0);
  const [hoverZoom, setHoverZoom] = React.useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = React.useState(false);
  const current = images[active];

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHoverZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[7/5] w-full overflow-hidden rounded-lg border border-border bg-surface sm:aspect-[4/3]">
        {current ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            onMouseMove={(e) => window.matchMedia("(hover: hover)").matches && onMove(e)}
            onMouseLeave={() => setHoverZoom(null)}
            aria-label={`Open ${name} photo ${active + 1} of ${images.length} full screen`}
            className="group absolute inset-0 block cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent"
          >
            <Image
              key={current.url}
              src={current.url}
              alt={current.alt || name}
              fill
              priority={active === 0}
              sizes="(min-width:1024px) 600px, 100vw"
              className={cn("object-cover transition-transform duration-300 ease-out", hoverZoom && "scale-[2]")}
              style={hoverZoom ? { transformOrigin: `${hoverZoom.x}% ${hoverZoom.y}%` } : undefined}
            />
            <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-pill bg-black/60 px-3 py-1.5 text-xs font-semibold text-white opacity-90 transition-opacity group-hover:opacity-0">
              <ZoomIn className="size-3.5" aria-hidden /> Zoom
            </span>
          </button>
        ) : (
          <ProductImage src={null} alt={name} sizes="(min-width:1024px) 600px, 100vw" />
        )}
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
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-md border-2 bg-surface transition-[border-color,translate] duration-300 hover:-translate-y-0.5",
                  i === active ? "border-primary" : "border-border hover:border-muted",
                )}
              >
                <Image src={img.url} alt="" fill sizes="100px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && <Lightbox images={images} name={name} index={active} onIndex={setActive} open={open} onOpenChange={setOpen} />}
    </div>
  );
}

function Lightbox({ images, name, index, onIndex, open, onOpenChange }: { images: Img[]; name: string; index: number; onIndex: (i: number) => void; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [zoom, setZoom] = React.useState<{ x: number; y: number } | null>(null);
  const img = images[index];
  const many = images.length > 1;
  const go = (step: number) => {
    setZoom(null);
    onIndex((index + step + images.length) % images.length);
  };

  const toggleZoom = (e: React.MouseEvent<HTMLElement>) => {
    if (zoom) return setZoom(null);
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  const pan = (e: React.MouseEvent<HTMLElement>) => {
    if (!zoom) return;
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setZoom(null);
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="pop-in max-w-5xl p-3 pt-12 sm:p-4 sm:pt-12"
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <DialogDescription className="sr-only">
          Photo {index + 1} of {images.length}. Click the photo to zoom in or out{many ? "; use the arrow keys for the next photo" : ""}.
        </DialogDescription>

        <div
          className={cn("relative h-[70vh] w-full touch-pinch-zoom overflow-hidden rounded-md bg-white", zoom ? "cursor-zoom-out" : "cursor-zoom-in")}
          onClick={toggleZoom}
          onMouseMove={pan}
        >
          <Image
            key={img.url}
            src={img.url}
            alt={img.alt || name}
            fill
            sizes="(min-width:1024px) 1000px, 100vw"
            className={cn("object-contain transition-transform duration-300 ease-out", zoom && "scale-[2.2]")}
            style={zoom ? { transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
          <span aria-live="polite">
            {index + 1} / {images.length}
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => (z ? null : { x: 50, y: 50 }))}
            aria-pressed={Boolean(zoom)}
            className="flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 transition-colors hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            {zoom ? <ZoomOut className="size-4" aria-hidden /> : <ZoomIn className="size-4" aria-hidden />} {zoom ? "Zoom out" : "Zoom in"}
          </button>
          {many && (
            <span className="flex gap-2">
              <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="rounded-full border border-border p-2 transition-colors hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Next photo" className="rounded-full border border-border p-2 transition-colors hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
