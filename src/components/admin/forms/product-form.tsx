"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormField, fieldA11y } from "@/components/admin/forms/form-field";
import { FormError, FormSuccess } from "@/components/admin/forms/form-feedback";
import { productStatusMeta, toMetaOptions } from "@/config/labels";
import { productSchema, type ProductFormValues, type ProductInput } from "@/lib/validation/product";
import { createProduct, updateProduct } from "@/services/products";
import { ApiRequestError } from "@/services/api-client";
import type { Category, Product } from "@/types";

const defaults: ProductFormValues = {
  name: "",
  sku: "",
  categoryId: 0,
  subcategoryId: null,
  price: 0,
  salePrice: null,
  status: "draft",
  featured: false,
  spiceLevel: 3,
  shortDescription: "",
  description: "",
};

const toFormValues = (p: Product): ProductFormValues => ({
  name: p.name,
  sku: p.sku,
  categoryId: Number(p.categoryId),
  subcategoryId: p.subcategoryId === null ? null : Number(p.subcategoryId),
  price: p.price,
  salePrice: p.salePrice,
  status: p.status,
  featured: p.featured,
  spiceLevel: p.spiceLevel,
  shortDescription: p.shortDescription,
  description: p.description,
});

export function ProductForm({ product, categories }: { product?: Product; categories: Category[] }) {
  const router = useRouter();
  const editing = Boolean(product);

  const {
    register,
    handleSubmit,
    setError,
    control,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? toFormValues(product) : defaults,
  });

  const mutation = useMutation({
    mutationFn: (values: ProductInput) => (product ? updateProduct(product.id, values) : createProduct(values)),
    onSuccess: (saved) => {
      // Let the success banner show briefly, then open the product with fresh server data.
      setTimeout(() => {
        router.push(`/admin/products/${saved.id}`);
        router.refresh();
      }, 700);
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.fields) {
        for (const [name, message] of Object.entries(err.fields)) setError(name as keyof ProductFormValues, { message });
      }
    },
  });

  const busy = mutation.isPending || mutation.isSuccess;
  const roots = categories.filter((c) => c.parentId === null && (c.active || String(c.id) === product?.categoryId));
  const selectedCategory = Number(useWatch({ control, name: "categoryId" })) || 0;
  const subcategories = categories.filter((c) => c.parentId === String(selectedCategory));
  const optionalNumber = { setValueAs: (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v)) };

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Product details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField label="Name" htmlFor="name" required error={errors.name?.message} className="sm:col-span-2">
            <Input {...fieldA11y("name", errors.name?.message)} placeholder="Boneless Chicken Pickle" {...register("name")} />
          </FormField>
          <FormField label="SKU" htmlFor="sku" required error={errors.sku?.message} hint="Unique stock-keeping code.">
            <Input {...fieldA11y("sku", errors.sku?.message, true)} placeholder="SP-CHK-BL" {...register("sku")} />
          </FormField>
          <FormField label="Category" htmlFor="categoryId" required error={errors.categoryId?.message}>
            <Select
              {...fieldA11y("categoryId", errors.categoryId?.message)}
              {...register("categoryId", {
                valueAsNumber: true,
                onChange: () => setValue("subcategoryId", null, { shouldDirty: true }),
              })}
            >
              <option value={0}>Select a category</option>
              {roots.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Subcategory" htmlFor="subcategoryId" error={errors.subcategoryId?.message} hint={subcategories.length ? undefined : "This category has no subcategories."}>
            <Select
              {...fieldA11y("subcategoryId", errors.subcategoryId?.message, subcategories.length === 0)}
              disabled={subcategories.length === 0}
              {...register("subcategoryId", { setValueAs: (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v)) })}
            >
              <option value="">None</option>
              {subcategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Price (₹)" htmlFor="price" required error={errors.price?.message} hint="Base price of the smallest pack.">
            <Input {...fieldA11y("price", errors.price?.message, true)} type="number" inputMode="decimal" step="0.01" min={0} {...register("price", { valueAsNumber: true })} />
          </FormField>
          <FormField label="Sale price (₹)" htmlFor="salePrice" error={errors.salePrice?.message} hint="Optional. Leave empty for no sale.">
            <Input {...fieldA11y("salePrice", errors.salePrice?.message, true)} type="number" inputMode="decimal" step="0.01" min={0} {...register("salePrice", optionalNumber)} />
          </FormField>
          <FormField label="Short description" htmlFor="shortDescription" error={errors.shortDescription?.message} className="sm:col-span-2">
            <Input {...fieldA11y("shortDescription", errors.shortDescription?.message)} placeholder="One line shown on product cards" {...register("shortDescription")} />
          </FormField>
          <FormField label="Description" htmlFor="description" required error={errors.description?.message} className="sm:col-span-2">
            <Textarea {...fieldA11y("description", errors.description?.message)} rows={6} {...register("description")} />
          </FormField>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Visibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField label="Status" htmlFor="status" error={errors.status?.message}>
              <Select {...fieldA11y("status", errors.status?.message)} {...register("status")}>
                {toMetaOptions(productStatusMeta).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </FormField>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="featured" className="text-sm font-semibold">Featured on storefront</label>
              <Switch id="featured" {...register("featured")} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Flavour</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField label="Spice level (0–5)" htmlFor="spiceLevel" required error={errors.spiceLevel?.message}>
              <Input {...fieldA11y("spiceLevel", errors.spiceLevel?.message)} type="number" inputMode="numeric" min={0} max={5} {...register("spiceLevel", { valueAsNumber: true })} />
            </FormField>
          </CardContent>
        </Card>
        {!editing && (
          <p className="text-xs text-muted">
            A default 250g pack with 0 stock is created for new products. Set stock levels from the Inventory page.
          </p>
        )}
      </div>

      <div className="space-y-3 lg:col-span-3">
        {mutation.isSuccess && <FormSuccess>{editing ? "Product updated." : "Product created."} Redirecting…</FormSuccess>}
        {mutation.isError && <FormError>{mutation.error.message || "Could not save the product. Please try again."}</FormError>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={editing && !isDirty}>
            {editing ? "Save changes" : "Create product"}
          </Button>
        </div>
      </div>
    </form>
  );
}
