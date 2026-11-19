"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Downloads a PDF from `url`, with a loading state and the server's error message if it fails. */
export function useInvoiceDownload() {
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const download = React.useCallback(async (url: string, key = url) => {
    setPending(key);
    setError(null);
    try {
      const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not prepare the invoice. Please try again.");
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "Invoice.pdf";
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare the invoice. Please try again.");
    } finally {
      setPending(null);
    }
  }, []);

  return { download, pending, error, clearError: () => setError(null) };
}

export function DownloadInvoiceButton({
  url,
  label = "Download invoice",
  variant = "secondary",
  size,
  className,
}: {
  url: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { download, pending, error } = useInvoiceDownload();
  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <Button type="button" variant={variant} size={size} loading={pending !== null} onClick={() => download(url)}>
        {pending === null && <Download className="size-4" aria-hidden />} {pending !== null ? "Preparing PDF…" : label}
      </Button>
      {error && (
        <span role="alert" className="max-w-xs text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
