import "server-only";
import type { StoreSettings } from "@/types";
import { execute, query } from "@/server/db";

const KEY = "general";

const DEFAULTS: StoreSettings = {
  storeName: "Sindhu's Pickles",
  tagline: "Premium Homemade Non-Veg",
  supportEmail: "sindhuspickles8@gmail.com",
  supportPhone: "+91 88380 83381",
  address: "1-1/154 Indhra Nagar, Mohan Nagar Post, Salem - 636030, Tamil Nadu, India",
  currency: "INR",
  freeShippingThreshold: 999,
  shippingFee: 60,
  welcomeCoupon: "SINDHU05",
  welcomeCouponPct: 5,
  lowStockDefault: 10,
  // Until the owner saves the toggle in Admin, fall back to the old env flag.
  codEnabled: process.env.ENABLE_COD === "true",
  notifyNewOrder: true,
  notifyLowStock: true,
  instagramUrl: "https://www.instagram.com/sindhuspickles",
  facebookUrl: "https://www.facebook.com/share/1AsxCwXvV7/",
  youtubeUrl: "",
};

/** Stored as one JSON document in `store_settings`; missing keys fall back to defaults. */
export async function getSettings(): Promise<StoreSettings> {
  const [row] = await query("SELECT setting_value FROM store_settings WHERE setting_key = ?", [KEY]);
  return { ...DEFAULTS, ...(row?.setting_value ?? {}) };
}

export async function updateSettings(input: StoreSettings): Promise<StoreSettings> {
  await execute(
    `INSERT INTO store_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [KEY, JSON.stringify(input)],
  );
  return getSettings();
}
