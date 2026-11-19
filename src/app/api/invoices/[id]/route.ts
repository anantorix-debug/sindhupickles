import { adminRoute, notFound, ok, parseId } from "@/server/http";
import { getInvoiceById } from "@/server/invoices/service";

/** Invoice details by invoice id. */
export const GET = adminRoute(async (_req, { params }) => {
  const invoice = await getInvoiceById(parseId((await params).id, "Invoice"));
  if (!invoice) throw notFound("Invoice");
  return ok(invoice);
});
