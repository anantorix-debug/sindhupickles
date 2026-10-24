import { z } from "zod";
import { created, ok, readJson } from "@/server/http";
import { execute } from "@/server/db";
import { storeRoute } from "@/server/store/http";
import { clientIp, rateLimit } from "@/server/store/rate-limit";

const schema = z.object({
  email: z.email("Enter a valid email address").max(190).transform((v) => v.toLowerCase()),
  /** Honeypot: people never see or fill this. */
  website: z.string().max(0).optional(),
});

/** Footer newsletter sign-up. Re-subscribing an existing address succeeds quietly (no enumeration). */
export const POST = storeRoute(async (req) => {
  rateLimit(`newsletter:${clientIp(req)}`, 8, 60 * 60_000);
  const { email } = await readJson(req, schema);
  const res = await execute("INSERT IGNORE INTO newsletter_subscribers (email) VALUES (?)", [email]);
  return res.affectedRows ? created({ subscribed: true }) : ok({ subscribed: true });
});
