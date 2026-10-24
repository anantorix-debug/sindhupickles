import { access, constants, mkdir } from "node:fs/promises";
import { NextResponse } from "next/server";
import { query } from "@/server/db";
import { UPLOADS_PERSISTENT, UPLOADS_ROOT } from "@/server/uploads";

export const dynamic = "force-dynamic";

/** Tables in db/schema.sql. */
const EXPECTED_TABLES = 30;

/**
 * Deployment check: open /api/store/health in a browser. It answers the first questions when a fresh server
 * shows an error page, and exposes only coarse facts (an error CODE, counts, yes/no), never hosts, users,
 * passwords or messages.
 */
export async function GET() {
  const status = {
    db: "ok",
    tables: 0,
    expectedTables: EXPECTED_TABLES,
    uploadsWritable: false,
    // true when uploads are stored outside the app folder (UPLOAD_DIR). On Hostinger every deploy gets a new app folder, so without it photos are lost on the next deploy.
    uploadDirSet: UPLOADS_PERSISTENT,
    // seconds since this copy of the app started (resets on every deploy/restart)
    uptimeSeconds: Math.round(process.uptime()),
    authSecretSet: (process.env.AUTH_SECRET ?? "").length >= 32,
    siteUrlSet: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  };

  try {
    const [row] = await query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()");
    status.tables = Number(row?.n ?? 0);
  } catch (err) {
    // e.g. ECONNREFUSED / ENOTFOUND (wrong DB_HOST), ER_ACCESS_DENIED_ERROR (wrong user or password), ER_BAD_DB_ERROR (wrong DB_NAME)
    status.db = (err as { code?: string }).code ?? "error";
  }

  try {
    await mkdir(UPLOADS_ROOT, { recursive: true });
    await access(UPLOADS_ROOT, constants.W_OK);
    status.uploadsWritable = true;
  } catch {
    status.uploadsWritable = false;
  }

  const healthy = status.db === "ok" && status.tables >= EXPECTED_TABLES && status.authSecretSet && status.uploadsWritable;
  return NextResponse.json(status, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
