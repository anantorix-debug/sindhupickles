import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type { Invoice } from "@/types";
import { orderStatusMeta, paymentStatusMeta } from "@/config/labels";
import { compactAddress } from "@/lib/invoice-format";

/**
 * A4 portrait invoice in the shop's colours: a dark header band with the logo and a large amber "INVOICE", three cream
 * cards (billed to / from / order details), the item table with a brown header row and striped lines, totals ending in
 * an orange "Total" bar next to a payment stamp (PAID / PAY ON DELIVERY / CANCELLED), a thank-you note, and a slim dark
 * strip on every page with the shop's contacts and page numbers. Mostly white, so it prints well.
 * Long names/addresses wrap and the table continues on new pages with its header repeated.
 *
 * Fonts: Noto Sans (SIL Open Font License, see assets/OFL.txt) because the PDF standard fonts have no ₹ sign.
 * The asset files are copied into the server build by `outputFileTracingIncludes` in next.config.ts.
 */

const ASSETS = join(process.cwd(), "src", "server", "invoices", "assets");
let assets: { regular: Buffer; bold: Buffer; logo: Buffer | null } | null = null;
function loadAssets() {
  if (!assets) {
    let logo: Buffer | null = null;
    try {
      logo = readFileSync(join(ASSETS, "logo.png"));
    } catch {
      logo = null; // the invoice still works without the logo
    }
    assets = { regular: readFileSync(join(ASSETS, "NotoSans-Regular.ttf")), bold: readFileSync(join(ASSETS, "NotoSans-Bold.ttf")), logo };
  }
  return assets;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: number) => inr.format(v);
const date = (isoDate: string) => {
  const d = new Date(isoDate);
  const p = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
};

// Brand colours (same as the website).
const ESPRESSO = "#1c1916";
const AMBER = "#f59e0b";
const ORANGE = "#b45309";
const BROWN = "#78350f";
const CREAM = "#fbf6ee";
const CREAM_LINE = "#efe4d3";
const INK = "#1f2937";
const BODY = "#374151";
const MUTED = "#6b7280";
const ON_DARK = "#faf8f5";
const ON_DARK_MUTED = "#c9bfb4";

const PAGE = { w: 595.28, h: 841.89, m: 40 };
const CONTENT_W = PAGE.w - PAGE.m * 2;
const STRIP_H = 26; // dark contact strip at the bottom of every page
const BOTTOM = PAGE.h - STRIP_H - 18; // content stops above it

type TextOpts = { size?: number; bold?: boolean; color?: string; width?: number; align?: "left" | "right" | "center"; spacing?: number };

export async function renderInvoicePdf(inv: Invoice): Promise<Buffer> {
  const a = loadAssets();
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE.m,
    bufferPages: true,
    // pdfkit accepts font data here (its typings only list a path); this keeps it from loading its own Helvetica files.
    font: a.regular as unknown as string,
    info: { Title: `Invoice ${inv.invoiceNumber}`, Author: inv.business.name, Subject: `Order ${inv.orderNumber}` },
  });
  doc.registerFont("regular", a.regular);
  doc.registerFont("bold", a.bold);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  // Lets text be drawn anywhere (bands, strip) without pdfkit deciding to start a new page.
  doc.page.margins.bottom = 0;
  doc.on("pageAdded", () => (doc.page.margins.bottom = 0));

  const text = (s: string, x: number, y: number, o: TextOpts = {}) => {
    doc.font(o.bold ? "bold" : "regular").fontSize(o.size ?? 9).fillColor(o.color ?? INK);
    doc.text(s, x, y, { width: o.width, align: o.align ?? "left", lineGap: 1.5, characterSpacing: o.spacing ?? 0 });
    return doc.y;
  };
  const heightOf = (s: string, width: number, size = 9, bold = false) => {
    doc.font(bold ? "bold" : "regular").fontSize(size);
    return doc.heightOfString(s, { width, lineGap: 1.5 });
  };
  const box = (x: number, y: number, w: number, h: number, color: string, r = 0) => {
    (r ? doc.roundedRect(x, y, w, h, r) : doc.rect(x, y, w, h)).fill(color);
  };
  const newPage = () => {
    doc.addPage();
    return PAGE.m;
  };

  // ---------- Header band ----------
  const BAND_H = 112;
  box(0, 0, PAGE.w, BAND_H, ESPRESSO);
  box(0, BAND_H, PAGE.w, 3, AMBER);
  let nameX = PAGE.m;
  if (a.logo) {
    doc.image(a.logo, PAGE.m, 16, { height: 80 });
    nameX = PAGE.m + 76;
  }
  text(inv.business.name, nameX, 34, { size: 18, bold: true, color: ON_DARK, width: 230 });
  if (inv.business.website) text(inv.business.website.replace(/^https?:\/\//, ""), nameX, 60, { size: 9, color: AMBER, width: 230 });
  const rightW = 220;
  const rightX = PAGE.w - PAGE.m - rightW;
  text("INVOICE", rightX, 22, { size: 28, bold: true, color: AMBER, width: rightW, align: "right", spacing: 3 });
  text(inv.invoiceNumber, rightX, 60, { size: 12, bold: true, color: ON_DARK, width: rightW, align: "right" });
  text(`Issued ${date(inv.invoiceDate)}`, rightX, 78, { size: 8.5, color: ON_DARK_MUTED, width: rightW, align: "right" });

  // ---------- Three cards: billed to / from / order details ----------
  const gap = 12;
  const cardW = (CONTENT_W - gap * 2) / 3;
  const pad = 11;
  const inner = cardW - pad * 2;
  type Line = { s: string; bold?: boolean; size?: number; color?: string };
  const billLines: Line[] = [
    { s: inv.billTo.name, bold: true, size: 9.5, color: INK },
    ...compactAddress(inv.billTo.addressLines).map((s) => ({ s })),
    ...[inv.billTo.phone, inv.billTo.email].filter(Boolean).map((s) => ({ s })),
  ];
  const shipsElsewhere = !(inv.sameAddress && inv.shipTo.name === inv.billTo.name);
  if (shipsElsewhere) {
    billLines.push({ s: "Ship to", bold: true, size: 8, color: ORANGE });
    billLines.push({ s: [inv.shipTo.name, ...compactAddress(inv.shipTo.addressLines), inv.shipTo.phone].filter(Boolean).join(", ") });
  }
  const fromLines: Line[] = [
    { s: inv.business.name, bold: true, size: 9.5, color: INK },
    ...compactAddress(inv.business.addressLines).map((s) => ({ s })),
    { s: inv.business.phone },
    { s: inv.business.email },
    ...(inv.business.gstin ? [{ s: `GSTIN: ${inv.business.gstin}`, bold: true }] : []),
  ];
  const details: [string, string][] = [
    ["Order no", inv.orderNumber],
    ["Order date", date(inv.orderDate)],
    ["Invoice date", date(inv.invoiceDate)],
    ["Payment", inv.paymentMethodLabel],
    ["Status", paymentStatusMeta[inv.paymentStatus]?.label ?? inv.paymentStatus],
  ];
  const linesH = (lines: Line[]) => lines.reduce((h, l) => h + heightOf(l.s, inner, l.size ?? 8.5, l.bold) + 1, 0);
  const detailsH = details.reduce((h, [, v]) => h + Math.max(heightOf(v, inner * 0.58, 8.5, true), 12) + 3, 0);
  const cardTop = BAND_H + 3 + 22;
  const billH = linesH(billLines) + (shipsElsewhere ? 0 : heightOf("Ships to this address", inner, 7.5) + 2);
  const cardH = Math.max(billH, linesH(fromLines), detailsH) + 34;
  const cards: { title: string; draw: (x: number, y: number) => void }[] = [
    {
      title: "BILLED TO",
      draw: (x, y) => {
        for (const l of billLines) y = text(l.s, x, y, { width: inner, size: l.size ?? 8.5, bold: l.bold, color: l.color ?? BODY }) + 1;
        if (!shipsElsewhere) text("Ships to this address", x, y + 2, { width: inner, size: 7.5, color: MUTED });
      },
    },
    { title: "FROM", draw: (x, y) => { for (const l of fromLines) y = text(l.s, x, y, { width: inner, size: l.size ?? 8.5, bold: l.bold, color: l.color ?? BODY }) + 1; } },
    {
      title: "ORDER DETAILS",
      draw: (x, y) => {
        for (const [k, v] of details) {
          text(k, x, y, { size: 8, color: MUTED, width: inner * 0.42 });
          const end = text(v, x + inner * 0.42, y, { size: 8.5, bold: true, color: INK, width: inner * 0.58, align: "right" });
          y = Math.max(end, y + 12) + 3;
        }
      },
    },
  ];
  cards.forEach((c, i) => {
    const x = PAGE.m + i * (cardW + gap);
    box(x, cardTop, cardW, cardH, CREAM, 6);
    box(x, cardTop, 3, cardH, i === 2 ? AMBER : ORANGE); // coloured edge
    text(c.title, x + pad, cardTop + 10, { size: 7.5, bold: true, color: ORANGE, spacing: 1.2 });
    c.draw(x + pad, cardTop + 25);
  });
  let y = cardTop + cardH + 26;

  // ---------- Items ----------
  const cols = { no: PAGE.m + 10, product: PAGE.m + 44, qty: PAGE.m + 296, unit: PAGE.m + 356, total: PAGE.m + 436 };
  const W = { product: 244, qty: 52, unit: 76, total: CONTENT_W - 446 };
  const tableHeader = (top: number) => {
    box(PAGE.m, top, CONTENT_W, 24, BROWN, 4);
    const t = top + 7;
    text("#", cols.no, t, { bold: true, size: 8, color: ON_DARK, spacing: 0.8 });
    text("PRODUCT", cols.product, t, { bold: true, size: 8, color: ON_DARK, spacing: 0.8 });
    text("QTY", cols.qty, t, { bold: true, size: 8, color: ON_DARK, width: W.qty, align: "center", spacing: 0.8 });
    text("UNIT PRICE", cols.unit, t, { bold: true, size: 8, color: ON_DARK, width: W.unit, align: "right", spacing: 0.8 });
    text("AMOUNT", cols.total, t, { bold: true, size: 8, color: ON_DARK, width: W.total, align: "right", spacing: 0.8 });
    return top + 30;
  };
  y = tableHeader(y);
  inv.items.forEach((it, i) => {
    const sub = [it.variantLabel, it.sku].filter(Boolean).join(" · ");
    const h = heightOf(it.name, W.product, 9.5) + (sub ? heightOf(sub, W.product, 7.5) : 0) + 14;
    if (y + h > BOTTOM) y = tableHeader(newPage());
    if (i % 2 === 1) box(PAGE.m, y - 5, CONTENT_W, h, CREAM, 3);
    text(String(i + 1).padStart(2, "0"), cols.no, y, { color: MUTED, size: 8.5 });
    let py = text(it.name, cols.product, y, { width: W.product, size: 9.5, color: INK });
    if (sub) py = text(sub, cols.product, py, { width: W.product, size: 7.5, color: MUTED });
    text(String(it.quantity), cols.qty, y, { width: W.qty, align: "center", size: 9.5, color: BODY });
    text(money(it.unitPrice), cols.unit, y, { width: W.unit, align: "right", size: 9.5, color: BODY });
    text(money(it.total), cols.total, y, { width: W.total, align: "right", size: 9.5, bold: true, color: INK });
    y = Math.max(py, y + 12) + 9;
  });
  doc.moveTo(PAGE.m, y - 2).lineTo(PAGE.w - PAGE.m, y - 2).lineWidth(0.8).strokeColor(CREAM_LINE).stroke();

  // ---------- Totals + payment stamp ----------
  const before: { label: string; value: string; color?: string }[] = [
    { label: "Subtotal", value: money(inv.subtotal) },
    ...(inv.discount > 0 ? [{ label: `Discount${inv.couponCode ? ` (${inv.couponCode})` : ""}`, value: `− ${money(inv.discount)}`, color: "#15803d" }] : []),
    { label: "Shipping", value: inv.shipping > 0 ? money(inv.shipping) : "Free" },
    ...(inv.tax > 0 ? [{ label: "Tax", value: money(inv.tax) }] : []),
  ];
  const after: { label: string; value: string; strong?: boolean }[] = [
    { label: "Amount paid", value: money(inv.amountPaid) },
    ...(inv.refunded > 0 ? [{ label: "Refunded", value: `− ${money(inv.refunded)}` }] : []),
    ...(inv.balanceDue > 0 ? [{ label: inv.paymentMethod === "cod" ? "Due on delivery" : "Balance due", value: money(inv.balanceDue), strong: true }] : []),
  ];
  const totalsH = (before.length + after.length) * 19 + 44;
  if (y + totalsH > BOTTOM) y = newPage();
  const tw = 236;
  const tx = PAGE.w - PAGE.m - tw;
  const totalsTop = y + 8;
  y = totalsTop;
  for (const r of before) {
    text(r.label, tx + 10, y, { size: 9, color: BODY, width: tw * 0.6 });
    text(r.value, tx, y, { size: 9, color: r.color ?? INK, width: tw - 10, align: "right" });
    y += 19;
  }
  box(tx, y, tw, 30, ORANGE, 5);
  text("TOTAL", tx + 10, y + 9, { size: 9, bold: true, color: ON_DARK, spacing: 1.5 });
  text(money(inv.total), tx, y + 6, { size: 13, bold: true, color: ON_DARK, width: tw - 10, align: "right" });
  y += 38;
  for (const r of after) {
    text(r.label, tx + 10, y, { size: 9, bold: r.strong, color: r.strong ? BROWN : BODY, width: tw * 0.6 });
    text(r.value, tx, y, { size: 9, bold: r.strong, color: r.strong ? BROWN : INK, width: tw - 10, align: "right" });
    y += 19;
  }

  // The stamp: what the customer most wants to know at a glance.
  const closed = ["cancelled", "refunded", "returned"].includes(inv.orderStatus);
  const stamp = closed
    ? { label: (orderStatusMeta[inv.orderStatus]?.label ?? "Cancelled").toUpperCase(), color: "#b91c1c" }
    : inv.balanceDue === 0 && inv.amountPaid > 0
      ? { label: "PAID", color: "#15803d" }
      : { label: inv.paymentMethod === "cod" ? "PAY ON DELIVERY" : "PAYMENT DUE", color: ORANGE };
  doc.font("bold").fontSize(15);
  const sw = doc.widthOfString(stamp.label, { characterSpacing: 2.5 }) + 30;
  const sx = PAGE.m + Math.max(10, (tx - PAGE.m - sw) / 2);
  const sy = totalsTop + 24;
  doc.save();
  doc.rotate(-10, { origin: [sx + sw / 2, sy + 18] });
  doc.roundedRect(sx, sy, sw, 36, 6).lineWidth(2.2).strokeColor(stamp.color).strokeOpacity(0.85).stroke();
  doc.roundedRect(sx + 4, sy + 4, sw - 8, 28, 4).lineWidth(0.8).strokeColor(stamp.color).strokeOpacity(0.6).stroke();
  doc.fillOpacity(0.9);
  text(stamp.label, sx, sy + 9, { size: 15, bold: true, color: stamp.color, width: sw, align: "center", spacing: 2.5 });
  doc.restore();
  doc.fillOpacity(1).strokeOpacity(1);

  // ---------- Thank-you note ----------
  const site = inv.business.website;
  const notes = [
    `Questions about this order? Call ${inv.business.phone} or email ${inv.business.email}.`,
    ...(site ? [`Shipping, return & refund policy: ${site}/policies/shipping-return-refund`, `Terms & conditions: ${site}/policies/terms`] : []),
    "This is a computer-generated invoice and does not need a signature.",
  ];
  const notesH = 30 + notes.reduce((h, l) => h + heightOf(l, CONTENT_W, 7.5) + 2, 0);
  y += 22;
  if (y + notesH > BOTTOM) y = newPage();
  box(PAGE.m + CONTENT_W / 2 - 22, y, 44, 2, AMBER);
  y = text(`Thank you for choosing ${inv.business.name}!`, PAGE.m, y + 10, { size: 12, bold: true, color: BROWN, width: CONTENT_W, align: "center" }) + 4;
  for (const l of notes) y = text(l, PAGE.m, y, { size: 7.5, color: MUTED, width: CONTENT_W, align: "center" }) + 2;

  // ---------- Contact strip + page numbers on every page ----------
  const range = doc.bufferedPageRange();
  const contacts = [site.replace(/^https?:\/\//, ""), inv.business.phone, inv.business.email].filter(Boolean).join("   ·   ");
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    box(0, PAGE.h - STRIP_H, PAGE.w, STRIP_H, ESPRESSO);
    text(contacts, PAGE.m, PAGE.h - STRIP_H + 8, { size: 7.5, color: ON_DARK_MUTED, width: CONTENT_W - 110 });
    const right = range.count > 1 ? `${inv.invoiceNumber}  ·  Page ${i + 1} of ${range.count}` : inv.invoiceNumber;
    text(right, PAGE.w - PAGE.m - 150, PAGE.h - STRIP_H + 8, { size: 7.5, bold: true, color: AMBER, width: 150, align: "right" });
  }

  doc.end();
  return done;
}
