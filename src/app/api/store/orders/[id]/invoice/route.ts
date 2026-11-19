import { parseId } from "@/server/http";
import { invoiceForOrderOrThrow, invoicePdfResponse } from "@/server/invoices/service";
import { requireCustomer, storeRoute } from "@/server/store/http";

/** A signed-in customer's invoice PDF for one of their own orders. Anyone else's order is a 404. */
export const GET = storeRoute(async (req, { params }) => {
  const customerId = await requireCustomer();
  const { invoice } = await invoiceForOrderOrThrow(parseId((await params).id, "Order"), customerId);
  return invoicePdfResponse(invoice, req.nextUrl.searchParams.get("inline") === "1");
});
