"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { FormError, FormSuccess } from "@/components/ui/form-feedback";
import { reviewSchema, type ReviewFormValues, type ReviewInput } from "@/lib/validation/store";
import { ApiRequestError } from "@/services/api-client";
import { storeApi } from "@/services/store";
import { cn } from "@/lib/utils";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Star rating + comment for a customer who has received this product. Saved as pending until the owner approves it. */
export function ReviewForm({ productSlug }: { productSlug: string }) {
  const router = useRouter();
  const [hover, setHover] = React.useState(0);
  const { register, handleSubmit, setValue, setError, control, formState: { errors } } = useForm<ReviewFormValues, unknown, ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { productSlug, rating: 0, title: "", comment: "" },
  });
  const rating = Number(useWatch({ control, name: "rating" })) || 0;

  const mutation = useMutation({
    mutationFn: storeApi.submitReview,
    onSuccess: () => router.refresh(),
    onError: (err) => {
      if (err instanceof ApiRequestError && err.fields) for (const [k, message] of Object.entries(err.fields)) setError(k as keyof ReviewFormValues, { message });
    },
  });

  if (mutation.isSuccess) {
    return <FormSuccess>Thank you! Your review will appear here once it has been approved.</FormSuccess>;
  }

  const shown = hover || rating;
  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <h3 className="font-display text-lg font-bold">Write a review</h3>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Your rating</legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent" onMouseEnter={() => setHover(n)}>
              <input
                type="radio"
                name="rating-choice"
                value={n}
                checked={rating === n}
                onChange={() => setValue("rating", n, { shouldValidate: true })}
                className="sr-only"
                aria-label={`${n} star${n > 1 ? "s" : ""} – ${LABELS[n]}`}
              />
              <Star className={cn("size-7 transition-colors", n <= shown ? "fill-accent text-accent" : "fill-transparent text-muted/60")} aria-hidden />
            </label>
          ))}
          <span className="ml-2 text-sm text-muted" aria-live="polite">{shown ? LABELS[shown] : "Tap a star"}</span>
        </div>
        {errors.rating?.message && <p role="alert" className="mt-1 text-xs text-danger">{errors.rating.message}</p>}
      </fieldset>

      <FormField label="Title (optional)" htmlFor="review-title" error={errors.title?.message}>
        <Input {...fieldA11y("review-title", errors.title?.message)} maxLength={100} placeholder="Sums it up in a few words" {...register("title")} />
      </FormField>
      <FormField label="Your review" htmlFor="review-comment" required error={errors.comment?.message}>
        <Textarea {...fieldA11y("review-comment", errors.comment?.message)} rows={4} maxLength={1500} placeholder="How was the taste, spice and freshness?" {...register("comment")} />
      </FormField>

      {mutation.isError && !(mutation.error instanceof ApiRequestError && mutation.error.fields) && <FormError>{mutation.error.message}</FormError>}
      <Button type="submit" loading={mutation.isPending}>Submit review</Button>
      <p className="text-xs text-muted">Reviews are checked by our team before they appear.</p>
    </form>
  );
}
