import { z } from "zod";
import { ok, readJson } from "@/server/http";
import { loginAdmin } from "@/server/admin/auth";
import { startAdminSession } from "@/server/admin/session";
import { storeRoute } from "@/server/store/http";
import { clientIp, rateLimit } from "@/server/store/rate-limit";

const schema = z.object({ email: z.email().max(190).transform((v) => v.toLowerCase()), password: z.string().min(1).max(200) });

/** Admin sign-in (checks the `users` table). Same-origin only; heavily rate limited. */
export const POST = storeRoute(async (req) => {
  const { email, password } = await readJson(req, schema);
  rateLimit(`admin-login:${clientIp(req)}`, 20, 15 * 60_000);
  rateLimit(`admin-login:${email}`, 6, 15 * 60_000);
  const admin = await loginAdmin(email, password);
  await startAdminSession(admin.id);
  return ok({ id: admin.id, name: admin.name, role: admin.role });
});
