import type { StoreSettings } from "@/types";
import { api } from "./api-client";

export const updateSettings = (input: StoreSettings) => api<StoreSettings>("/settings", { method: "PUT", body: input });
