import { enquirySchema } from "@/lib/validation/store";
import { created, readJson } from "@/server/http";
import { createEnquiry } from "@/server/repositories/enquiries";
import { storeRoute } from "@/server/store/http";
import { clientIp, rateLimit } from "@/server/store/rate-limit";

/** Contact-form submissions → Admin → Enquiries. */
export const POST = storeRoute(async (req) => {
  rateLimit(`enquiry:${clientIp(req)}`, 5, 60 * 60_000);
  const v = await readJson(req, enquirySchema);
  await createEnquiry({ name: v.name, email: v.email, phone: v.phone || null, message: v.message });
  return created({ received: true });
});
