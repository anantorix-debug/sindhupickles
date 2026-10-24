import { ApiError, created, adminRoute } from "@/server/http";
import { MAX_UPLOAD_BYTES, UPLOAD_FOLDERS, saveImage, type UploadFolder } from "@/server/uploads";

/** multipart/form-data with a `file` field (and optional `folder`). Max 3 MB; JPG, PNG or WebP. */
export const POST = adminRoute(async (req) => {
  // Reject oversized bodies early, before buffering them.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    throw new ApiError(413, "Image is too large. The limit is 3 MB.", "file_too_large");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "Send the image as multipart/form-data", "bad_form");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "No image was attached", "no_file", { file: "Choose an image" });

  const folderRaw = String(form.get("folder") ?? "products");
  const folder = (UPLOAD_FOLDERS as readonly string[]).includes(folderRaw) ? (folderRaw as UploadFolder) : "products";
  return created({ url: await saveImage(file, folder) });
});
