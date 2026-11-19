import { adminRoute, created, ok, parseId } from "@/server/http";
import { invoiceForOrderOrThrow } from "@/server/invoices/service";

/** The order's invoice details. Placed orders always have one: it is created here if it doesn't exist yet. */
export const GET = adminRoute(async (_req, { params }) => {
  const { invoice } = await invoiceForOrderOrThrow(parseId((await params).id, "Order"));
  return ok(invoice);
});

/** Generate the invoice if it doesn't exist (201), or return the existing one (200). Safe to repeat. */
export const POST = adminRoute(async (_req, { params }) => {
  const { invoice, created: isNew } = await invoiceForOrderOrThrow(parseId((await params).id, "Order"));
  return isNew ? created(invoice) : ok(invoice);
});
