import { z } from "zod";
import { ApiError, ok, readJson } from "@/server/http";
import { loginAdmin } from "@/server/admin/auth";
import { startAdminSession } from "@/server/admin/session";
import { storeRoute } from "@/server/store/http";
import { clientIp, rateLimitCheck, rateLimitFail, rateLimitReset } from "@/server/store/rate-limit";

const schema = z.object({ email: z.email().max(190).transform((v) => v.toLowerCase()), password: z.string().min(1).max(200) });

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES_PER_EMAIL = 10;
const MAX_FAILURES_PER_IP = 40;

/**
 * Admin sign-in (checks the `users` table). Same-origin only. Only WRONG passwords count towards the limit
 * (10 per account and 40 per address in 15 minutes), and a correct sign-in clears the count.
 */
export const POST = storeRoute(async (req) => {
  const { email, password } = await readJson(req, schema);
  const ipKey = `admin-login:ip:${clientIp(req)}`;
  const emailKey = `admin-login:email:${email}`;
  rateLimitCheck(ipKey, MAX_FAILURES_PER_IP, WINDOW_MS);
  rateLimitCheck(emailKey, MAX_FAILURES_PER_EMAIL, WINDOW_MS);

  let admin;
  try {
    admin = await loginAdmin(email, password);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      rateLimitFail(ipKey, WINDOW_MS);
      rateLimitFail(emailKey, WINDOW_MS);
    }
    throw err;
  }
  rateLimitReset(emailKey);
  await startAdminSession(admin.id);
  return ok({ id: admin.id, name: admin.name, role: admin.role });
});
