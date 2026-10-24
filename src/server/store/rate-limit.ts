import "server-only";
import { ApiError } from "@/server/http";

const g = globalThis as unknown as { __rl?: Map<string, number[]> };
const hits = (g.__rl ??= new Map<string, number[]>());

/**
 * Small in-memory sliding-window limiter for auth endpoints. It is per-process,
 * so behind multiple instances replace it with a shared store (e.g. Redis).
 */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    throw new ApiError(429, "Too many attempts. Please wait a few minutes and try again.", "rate_limited");
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
}

/**
 * For sign-in: only FAILED attempts count. `rateLimitCheck` refuses (429) once `key` already has `max` failures in the
 * window; `rateLimitFail` records one failure; `rateLimitReset` forgets them after a successful sign-in. So a person who
 * knows their password is never locked out, while guessing is still stopped.
 */
export function rateLimitCheck(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw new ApiError(429, "Too many failed attempts. Please wait a few minutes and try again.", "rate_limited");
}

export function rateLimitFail(key: string, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
}

export const rateLimitReset = (key: string) => void hits.delete(key);

export const clientIp =(req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
