"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiRequestError } from "@/services/api-client";

/** Subscribe form from the Figma newsletter band. No form library needed for one field. */
export function NewsletterForm() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const website = String(new FormData(e.currentTarget).get("website") ?? "");
    setState("busy");
    setError(null);
    try {
      await api("/store/newsletter", { method: "POST", body: { email, website } });
      setState("done");
    } catch (err) {
      setError(err instanceof ApiRequestError && err.fields?.email ? err.fields.email : "Couldn't subscribe right now. Please try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="flex items-center justify-center gap-2 font-semibold text-white">
        <Check className="size-5" aria-hidden /> You&apos;re in! Watch your inbox for fresh batches.
      </p>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="mx-auto w-full max-w-lg">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">Email address</label>
        <input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "newsletter-error" : undefined}
          className="h-[52px] flex-1 rounded-md border border-border bg-background px-4 text-foreground placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-accent"
        />
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <input name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <Button type="submit" size="lg" loading={state === "busy"}>
          Subscribe
        </Button>
      </div>
      {error && (
        <p id="newsletter-error" role="alert" className="mt-2 text-sm text-white">
          {error}
        </p>
      )}
    </form>
  );
}
