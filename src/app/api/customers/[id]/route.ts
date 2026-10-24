import { notFound, ok, parseId, adminRoute } from "@/server/http";
import { getCustomer } from "@/server/repositories/customers";

export const GET = adminRoute(async (_req, { params }) => {
  const customer = await getCustomer(parseId((await params).id, "Customer"));
  if (!customer) throw notFound("Customer");
  return ok(customer);
});
