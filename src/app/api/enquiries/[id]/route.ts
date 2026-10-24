import { enquiryReadSchema } from "@/lib/validation/content";
import { ok, parseId, readJson, adminRoute } from "@/server/http";
import { deleteEnquiry, setEnquiryRead } from "@/server/repositories/enquiries";

export const PATCH = adminRoute(async (req, { params }) => {
  const id = parseId((await params).id, "Enquiry");
  const { isRead } = await readJson(req, enquiryReadSchema);
  await setEnquiryRead(id, isRead);
  return ok({ id, isRead });
});

export const DELETE = adminRoute(async (_req, { params }) => {
  await deleteEnquiry(parseId((await params).id, "Enquiry"));
  return ok({ deleted: true });
});
