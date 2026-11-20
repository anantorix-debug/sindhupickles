/**
 * Compact address for invoices: the street parts on one line (it wraps if long) and "city pin, state, country" on the
 * next, instead of one line per part. Stray commas from how the address was typed are tidied up.
 */
export function compactAddress(lines: string[]): string[] {
  const parts = lines.map((l) => l.replace(/\s*,[\s,]*/g, ", ").replace(/^[,\s]+|[,\s]+$/g, "").trim()).filter(Boolean);
  if (parts.length <= 2) return parts;
  const tail = Math.min(3, parts.length - 1); // city + pin, state, country
  return [parts.slice(0, -tail).join(", "), parts.slice(-tail).join(", ")];
}
