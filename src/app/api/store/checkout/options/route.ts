import { ok } from "@/server/http";
import { storeRoute } from "@/server/store/http";
import { listAvailableProviders } from "@/server/store/payments/providers";

/** Payment methods currently offered at checkout. */
export const GET = storeRoute(async () =>
  ok((await listAvailableProviders()).map((p) => ({ id: p.id, label: p.label, description: p.description }))),
);
