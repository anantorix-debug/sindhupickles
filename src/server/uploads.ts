import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ApiError } from "@/server/http";

/** Same limit as Kuttima's Multer upload config. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export const UPLOAD_FOLDERS = ["products", "blog"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

// Files live outside `public/` so they are served at runtime in production too.
const ROOT = path.join(process.cwd(), "uploads");

const TYPES = {
  jpg: { mime: "image/jpeg", test: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  png: { mime: "image/png", test: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  webp: { mime: "image/webp", test: (b: Buffer) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
} as const;
type Ext = keyof typeof TYPES;

export const mimeForExt = (ext: string) => TYPES[ext as Ext]?.mime;

/** Validates by file signature (not the client-supplied type) and stores under a random name. */
export async function saveImage(file: File, folder: UploadFolder): Promise<string> {
  if (file.size === 0) throw new ApiError(422, "The file is empty", "empty_file");
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "Image is too large. The limit is 3 MB.", "file_too_large");

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = (Object.keys(TYPES) as Ext[]).find((e) => TYPES[e].test(bytes));
  if (!ext) throw new ApiError(415, "Only JPG, PNG or WebP images are allowed.", "bad_file_type");

  const dir = path.join(ROOT, folder);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), bytes);
  return `/uploads/${folder}/${name}`;
}

/** Resolves a request path like ["products", "<uuid>.png"] to file bytes, or null. */
export async function readUpload(segments: string[]): Promise<{ bytes: Buffer; mime: string } | null> {
  if (segments.length !== 2) return null;
  const [folder, name] = segments;
  if (!(UPLOAD_FOLDERS as readonly string[]).includes(folder)) return null;
  const match = name.match(/^[0-9a-f-]{36}\.(jpg|png|webp)$/);
  if (!match) return null;
  try {
    return { bytes: await readFile(path.join(ROOT, folder, name)), mime: TYPES[match[1] as Ext].mime };
  } catch {
    return null;
  }
}
