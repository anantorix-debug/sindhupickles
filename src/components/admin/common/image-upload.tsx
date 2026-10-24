"use client";

import * as React from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_IMAGE_MB, uploadImage } from "@/services/uploads";

interface ImageUploadProps {
  folder: "products" | "blog";
  label?: string;
  onUploaded: (url: string) => void | Promise<void>;
  disabled?: boolean;
}

/** File picker that uploads immediately (JPG, PNG or WebP, up to 3 MB) and reports the new URL. */
export function ImageUpload({ folder, label = "Upload image", onUploaded, disabled }: ImageUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await onUploaded(await uploadImage(file, folder));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onChange} tabIndex={-1} aria-hidden />
      <Button type="button" variant="secondary" loading={busy} disabled={disabled} onClick={() => inputRef.current?.click()}>
        <ImagePlus className="size-4" aria-hidden /> {label}
      </Button>
      <p className="mt-1.5 text-xs text-muted">JPG, PNG or WebP · max {MAX_IMAGE_MB} MB</p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
