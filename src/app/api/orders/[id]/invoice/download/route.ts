import { adminRoute, parseId } from "@/server/http";
import { invoiceForOrderOrThrow, invoicePdfResponse } from "@/server/invoices/service";

/** The invoice as an A4 PDF (Invoice_<order>.pdf). `?inline=1` opens it in the browser instead of downloading. */
export const GET = adminRoute(async (req, { params }) => {
  const { invoice } = await invoiceForOrderOrThrow(parseId((await params).id, "Order"));
  return invoicePdfResponse(invoice, req.nextUrl.searchParams.get("inline") === "1");
});
