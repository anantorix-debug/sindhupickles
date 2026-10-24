"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormField, fieldA11y } from "@/components/admin/forms/form-field";
import { FormError } from "@/components/admin/forms/form-feedback";
import { categorySchema, type CategoryFormValues, type CategoryInput } from "@/lib/validation/content";
import { createCategory, updateCategory } from "@/services/categories";
import { ApiRequestError } from "@/services/api-client";
import type { Category } from "@/types";

/** `null` = closed, `"new"` = create, a Category = edit. */
export type CategoryDialogTarget = Category | "new" | null;

interface Props {
  target: CategoryDialogTarget;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
}

export function CategoryDialog({ target, categories, onOpenChange }: Props) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {target !== null && (
          <CategoryForm
            key={target === "new" ? "new" : target.id}
            category={target === "new" ? undefined : target}
            all={categories}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({ category, all, onDone }: { category?: Category; all: Category[]; onDone: () => void }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CategoryFormValues, unknown, CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      parentId: category?.parentId ? Number(category.parentId) : null,
      active: category?.active ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (v: CategoryInput) => (category ? updateCategory(category.id, v) : createCategory(v)),
    onSuccess: () => {
      onDone();
      router.refresh();
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.fields) {
        for (const [k, message] of Object.entries(err.fields)) setError(k as keyof CategoryFormValues, { message });
      }
    },
  });

  // A category that already has subcategories can't itself become a subcategory.
  const hasChildren = category ? all.some((c) => c.parentId === category.id) : false;
  const parents = all.filter((c) => c.parentId === null && c.id !== category?.id);

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
        <DialogDescription>Categories organise products on the storefront.</DialogDescription>
      </DialogHeader>
      <FormField label="Name" htmlFor="name" required error={errors.name?.message}>
        <Input {...fieldA11y("name", errors.name?.message)} autoFocus {...register("name")} />
      </FormField>
      <FormField label="Slug" htmlFor="slug" error={errors.slug?.message} hint="Leave empty to generate from the name.">
        <Input {...fieldA11y("slug", errors.slug?.message, true)} placeholder="chicken-pickles" {...register("slug")} />
      </FormField>
      <FormField label="Parent category" htmlFor="parentId" error={errors.parentId?.message}>
        <Select
          {...fieldA11y("parentId", errors.parentId?.message)}
          disabled={hasChildren}
          {...register("parentId", { setValueAs: (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v)) })}
        >
          <option value="">None (top-level)</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Description" htmlFor="description" error={errors.description?.message}>
        <Textarea {...fieldA11y("description", errors.description?.message)} rows={3} {...register("description")} />
      </FormField>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="active" className="text-sm font-semibold">Visible on storefront</label>
        <Switch id="active" {...register("active")} />
      </div>
      {mutation.isError && <FormError>{mutation.error.message}</FormError>}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" loading={mutation.isPending}>{category ? "Save changes" : "Create category"}</Button>
      </DialogFooter>
    </form>
  );
}
