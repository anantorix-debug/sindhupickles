import { ok } from "@/server/http";
import { storeRoute } from "@/server/store/http";
import { endSession } from "@/server/store/session";

export const POST = storeRoute(async () => {
  await endSession();
  return ok({ signedOut: true });
});
