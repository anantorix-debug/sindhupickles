"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/admin/common/image-upload";
import { ConfirmDialog } from "@/components/admin/common/confirm-dialog";
import { FormError } from "@/components/admin/forms/form-feedback";
import { addProductImage, removeProductImage, setPrimaryProductImage } from "@/services/products";
import type { Product, ProductImage } from "@/types";

export function ProductImages({ product }: { product: Product }) {
  const router = useRouter();
  const [toRemove, setToRemove] = React.useState<ProductImage | null>(null);
  const done = () => router.refresh();

  const primary = useMutation({ mutationFn: (imageId: string) => setPrimaryProductImage(product.id, imageId), onSuccess: done });
  const remove = useMutation({
    mutationFn: (imageId: string) => removeProductImage(product.id, imageId),
    onSuccess: () => {
      setToRemove(null);
      done();
    },
  });
  const add = useMutation({ mutationFn: (url: string) => addProductImage(product.id, url, product.name), onSuccess: done });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Images</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {product.images.length === 0 ? (
          <p className="text-sm text-muted">No images yet. The first image is used as the main product photo.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {product.images.map((img, i) => (
              <li key={img.id} className="overflow-hidden rounded-md border border-border bg-background">
                {/* Plain <img>: uploads are served by our own route and seeded paths belong to the storefront. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt} loading="lazy" className="aspect-square w-full bg-surface-raised object-cover text-xs text-muted" />
                <div className="flex items-center justify-between gap-1 p-2">
                  {i === 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                      <Star className="size-3.5 fill-accent" aria-hidden /> Main
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" loading={primary.isPending && primary.variables === img.id} onClick={() => primary.mutate(img.id)}>
                      Make main
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" aria-label={`Remove image ${i + 1}`} onClick={() => setToRemove(img)}>
                    <Trash2 className="size-4 text-danger" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <ImageUpload folder="products" label="Upload image" onUploaded={(url) => add.mutateAsync(url).then(() => undefined)} />
        {(primary.isError || add.isError) && <FormError>{(primary.error ?? add.error)?.message}</FormError>}
      </CardContent>
      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(o) => !o && setToRemove(null)}
        title="Remove image?"
        description="The image is removed from this product. The uploaded file is kept."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => toRemove && remove.mutate(toRemove.id)}
      >
        {remove.isError && <FormError>{remove.error.message}</FormError>}
      </ConfirmDialog>
    </Card>
  );
}
