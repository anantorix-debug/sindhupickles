import { ok } from "@/server/http";
import { endAdminSession } from "@/server/admin/session";
import { storeRoute } from "@/server/store/http";

export const POST = storeRoute(async () => {
  await endAdminSession();
  return ok({ signedOut: true });
});
