"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FormField, fieldA11y } from "@/components/admin/forms/form-field";
import { FormError, FormSuccess } from "@/components/admin/forms/form-feedback";
import { ImageUpload } from "@/components/admin/common/image-upload";
import { blogPostSchema, type BlogFormValues, type BlogPostInput } from "@/lib/validation/content";
import { createPost, updatePost } from "@/services/blog";
import { ApiRequestError } from "@/services/api-client";
import type { BlogPost } from "@/types";

const defaults: BlogFormValues = {
  title: "",
  slug: "",
  category: "",
  authorName: "",
  excerpt: "",
  content: "",
  featuredImage: "",
  tags: "",
  status: "draft",
  metaTitle: "",
  metaDescription: "",
  focusKeyword: "",
};

export function BlogForm({ post, categories }: { post?: BlogPost; categories: string[] }) {
  const router = useRouter();
  const editing = Boolean(post);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<BlogFormValues, unknown, BlogPostInput>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: post
      ? {
          title: post.title,
          slug: post.slug,
          category: post.category,
          authorName: post.authorName ?? "",
          excerpt: post.excerpt,
          content: post.content,
          featuredImage: post.featuredImage ?? "",
          tags: post.tags.join(", "),
          status: post.status,
          metaTitle: post.metaTitle,
          metaDescription: post.metaDescription,
          focusKeyword: post.focusKeyword,
        }
      : defaults,
  });

  const mutation = useMutation({
    mutationFn: (v: BlogPostInput) => (post ? updatePost(post.id, v) : createPost(v)),
    onSuccess: () => {
      setTimeout(() => {
        router.push("/admin/blog");
        router.refresh();
      }, 700);
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.fields) {
        for (const [k, message] of Object.entries(err.fields)) setError(k as keyof BlogFormValues, { message });
      }
    },
  });

  const busy = mutation.isPending || mutation.isSuccess;
  const image = useWatch({ control, name: "featuredImage" });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField label="Title" htmlFor="title" required error={errors.title?.message}>
              <Input {...fieldA11y("title", errors.title?.message)} {...register("title")} />
            </FormField>
            <FormField label="Excerpt" htmlFor="excerpt" error={errors.excerpt?.message} hint="Short summary shown in post lists.">
              <Textarea {...fieldA11y("excerpt", errors.excerpt?.message, true)} rows={2} {...register("excerpt")} />
            </FormField>
            <FormField label="Body" htmlFor="content" required error={errors.content?.message} hint="Blank lines separate paragraphs. Start a line with ## for a heading, - for a bullet point. **bold** and [link text](https://…) also work. Read time is calculated automatically.">
              <Textarea {...fieldA11y("content", errors.content?.message, true)} rows={16} {...register("content")} />
            </FormField>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField label="Meta title" htmlFor="metaTitle" error={errors.metaTitle?.message}>
              <Input {...fieldA11y("metaTitle", errors.metaTitle?.message)} {...register("metaTitle")} />
            </FormField>
            <FormField label="Meta description" htmlFor="metaDescription" error={errors.metaDescription?.message}>
              <Textarea {...fieldA11y("metaDescription", errors.metaDescription?.message)} rows={2} {...register("metaDescription")} />
            </FormField>
            <FormField label="Focus keyword" htmlFor="focusKeyword" error={errors.focusKeyword?.message}>
              <Input {...fieldA11y("focusKeyword", errors.focusKeyword?.message)} {...register("focusKeyword")} />
            </FormField>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField label="Status" htmlFor="status" error={errors.status?.message}>
              <Select {...fieldA11y("status", errors.status?.message)} {...register("status")}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </FormField>
            <FormField label="Category" htmlFor="category" required error={errors.category?.message}>
              <Input {...fieldA11y("category", errors.category?.message)} list="blog-categories" placeholder="Recipes" {...register("category")} />
              <datalist id="blog-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Author" htmlFor="authorName" error={errors.authorName?.message}>
              <Input {...fieldA11y("authorName", errors.authorName?.message)} {...register("authorName")} />
            </FormField>
            <FormField label="Tags" htmlFor="tags" error={errors.tags?.message} hint="Comma separated.">
              <Input {...fieldA11y("tags", errors.tags?.message, true)} placeholder="pickle, spice" {...register("tags")} />
            </FormField>
            <FormField label="Slug" htmlFor="slug" error={errors.slug?.message} hint="Leave empty to generate from the title.">
              <Input {...fieldA11y("slug", errors.slug?.message, true)} {...register("slug")} />
            </FormField>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Featured image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {image && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Featured" className="aspect-video w-full rounded-md border border-border object-cover" />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2 size-8"
                  aria-label="Remove featured image"
                  onClick={() => setValue("featuredImage", "", { shouldDirty: true })}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            )}
            <ImageUpload folder="blog" label={image ? "Replace image" : "Upload image"} onUploaded={(url) => setValue("featuredImage", url, { shouldDirty: true })} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3 lg:col-span-3">
        {mutation.isSuccess && <FormSuccess>{editing ? "Post updated." : "Post created."} Redirecting…</FormSuccess>}
        {mutation.isError && <FormError>{mutation.error.message}</FormError>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={editing && !isDirty}>
            {editing ? "Save changes" : "Create post"}
          </Button>
        </div>
      </div>
    </form>
  );
}
