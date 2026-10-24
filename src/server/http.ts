import "server-only";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin/auth";

/** An error that is safe to show to API clients. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public fields?: Record<string, string>,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (entity: string) => new ApiError(404, `${entity} not found`, "not_found");

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json({ data }, init);
export const created = <T>(data: T) => NextResponse.json({ data }, { status: 201 });

type Ctx = { params: Promise<Record<string, string>> };

/** Wraps a handler so thrown errors become a consistent `{ error }` JSON response. */
export function route(fn: (req: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: { code: err.code, message: err.message, fields: err.fields, details: err.details } }, { status: err.status });
      }
      if (err instanceof z.ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
        return NextResponse.json({ error: { code: "validation_error", message: "Some fields are invalid", fields } }, { status: 422 });
      }
      console.error("[api]", req.method, req.nextUrl.pathname, err);
      return NextResponse.json({ error: { code: "internal_error", message: "Something went wrong" } }, { status: 500 });
    }
  };
}

/**
 * Admin API wrapper: identical to `route`, but any successful write also refreshes the
 * cached storefront, so admin changes (products, stock, prices, categories, settings...)
 * show up on the public site straight away.
 */
export const adminRoute: typeof route = (fn) =>
  route(async (req, ctx) => {
    await requireAdmin();
    const res = await fn(req, ctx);
    if (req.method !== "GET" && res.status < 400) revalidatePath("/", "layout");
    return res;
  });

export async function readJson<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON", "bad_json");
  }
  return schema.parse(body);
}

/** Parses a numeric id path segment; database ids are unsigned integers. */
export function parseId(raw: string, entity = "Record"): string {
  if (!/^\d{1,18}$/.test(raw)) throw notFound(entity);
  return raw;
}
