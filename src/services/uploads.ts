import { ApiRequestError } from "./api-client";

export const MAX_IMAGE_MB = 3;

/** Uploads one image (JPG/PNG/WebP, max 3 MB) and returns its public URL. */
export async function uploadImage(file: File, folder: "products" | "blog" | "categories"): Promise<string> {
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new ApiRequestError(`Image is too large. The limit is ${MAX_IMAGE_MB} MB.`, 413);
  }
  const body = new FormData();
  body.set("file", file);
  body.set("folder", folder);
  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body });
  } catch {
    throw new ApiRequestError("Can't reach the server. Check your connection and try again.", 0);
  }
  const json = (await res.json().catch(() => null)) as { data?: { url: string }; error?: { message: string } } | null;
  if (!res.ok || !json?.data) throw new ApiRequestError(json?.error?.message ?? "Upload failed", res.status);
  return json.data.url;
}
