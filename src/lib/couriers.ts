/** The courier the shop ships with. Used as the default carrier when adding tracking to an order. */
export const DEFAULT_CARRIER = "ST Courier";

const TRACKING_PAGES: { match: RegExp; url: string }[] = [{ match: /\bst\s*courier\b/i, url: "https://stcourier.com/track/shipment" }];

/** The carrier's public tracking page, if we know it. The customer enters the AWB number there. */
export const trackingPageUrl = (carrier: string): string | null => TRACKING_PAGES.find((c) => c.match.test(carrier))?.url ?? null;
