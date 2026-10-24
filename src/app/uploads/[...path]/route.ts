import { NextResponse } from "next/server";
import { readUpload } from "@/server/uploads";

/** Serves files saved by /api/upload. File names are random UUIDs, so they're safe to cache forever. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const file = await readUpload((await params).path);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
