import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type { Invoice } from "@/types";
import { orderStatusMeta, paymentStatusMeta } from "@/config/labels";
import { compactAddress } from "@/lib/invoice-format";

/**
 * A4 portrait invoice, laid out like the shop's sample invoice: title + logo and the shop's address on top, then
 * "Bill to" and the invoice details side by side, the item table, totals on the right and a short footer.
 * Long addresses wrap, the table continues on new pages (header repeated) and pages are numbered when there are several.
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

const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const ACCENT = "#9a3412";

const PAGE = { w: 595.28, h: 841.89, m: 40 };
const CONTENT_W = PAGE.w - PAGE.m * 2;
// Content stops at the bottom margin; page numbers are printed inside the margin, below it.
const BOTTOM = PAGE.h - PAGE.m - 4;

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

  const text = (s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: string; width?: number; align?: "left" | "right" | "center" } = {}) => {
    doc.font(o.bold ? "bold" : "regular").fontSize(o.size ?? 9.5).fillColor(o.color ?? INK);
    doc.text(s, x, y, { width: o.width, align: o.align ?? "left", lineGap: 1.5 });
    return doc.y;
  };
  const heightOf = (s: string, width: number, size = 9.5, bold = false) => {
    doc.font(bold ? "bold" : "regular").fontSize(size);
    return doc.heightOfString(s, { width, lineGap: 1.5 });
  };
  const rule = (y: number, x1 = PAGE.m, x2 = PAGE.w - PAGE.m) => doc.moveTo(x1, y).lineTo(x2, y).lineWidth(0.7).strokeColor(LINE).stroke();

  // ---------- Header: title, logo | From ----------
  const rightX = PAGE.m + CONTENT_W * 0.6;
  const rightW = CONTENT_W * 0.4;
  text("INVOICE", PAGE.m, PAGE.m - 4, { size: 24, bold: true });
  const closed = ["cancelled", "refunded", "returned"].includes(inv.orderStatus);
  if (closed) text(orderStatusMeta[inv.orderStatus]?.label.toUpperCase() ?? "CANCELLED", PAGE.m + 130, PAGE.m + 5, { size: 11, bold: true, color: "#b91c1c" });
  let leftY = PAGE.m + 34;
  if (a.logo) {
    doc.image(a.logo, PAGE.m + 6, leftY, { height: 86 });
    leftY += 96;
  }

  let y = PAGE.m;
  y = text("From", rightX, y, { bold: true, size: 9.5 });
  const fromLines = [inv.business.name, ...compactAddress(inv.business.addressLines), inv.business.phone, inv.business.email, ...(inv.business.gstin ? [`GSTIN: ${inv.business.gstin}`] : [])];
  for (const l of fromLines) y = text(l, rightX, y + 1, { width: rightW, color: "#374151" });
  y = Math.max(y, leftY) + 22;

  // ---------- Bill to | Invoice details ----------
  const billTop = y;
  let by = text("Bill to", PAGE.m, billTop, { bold: true });
  const leftW = CONTENT_W * 0.5;
  const contact = [inv.billTo.phone, inv.billTo.email].filter(Boolean).join("  ·  ");
  for (const l of [inv.billTo.name, ...compactAddress(inv.billTo.addressLines), contact].filter(Boolean)) by = text(l, PAGE.m, by + 1, { width: leftW, color: "#374151" });
  by += 8;
  by = text("Ship to", PAGE.m, by, { bold: true });
  if (inv.sameAddress && inv.shipTo.name === inv.billTo.name) by = text("Same as billing address", PAGE.m, by + 1, { width: leftW, color: MUTED });
  else for (const l of [inv.shipTo.name, ...compactAddress(inv.shipTo.addressLines), inv.shipTo.phone].filter(Boolean)) by = text(l, PAGE.m, by + 1, { width: leftW, color: "#374151" });

  let ry = billTop;
  doc.font("bold").fontSize(11).fillColor(INK).text("Invoice no: ", rightX, ry, { continued: true });
  doc.font("regular").fontSize(11).text(inv.invoiceNumber);
  ry = doc.y + 3;
  const details: [string, string][] = [
    ["Order no:", inv.orderNumber],
    ["Invoice date:", date(inv.invoiceDate)],
    ["Order date:", date(inv.orderDate)],
    ["Payment method:", inv.paymentMethodLabel],
    ["Payment status:", paymentStatusMeta[inv.paymentStatus]?.label ?? inv.paymentStatus],
  ];
  for (const [k, v] of details) {
    doc.font("bold").fontSize(9.5).fillColor(INK).text(`${k} `, rightX, ry, { continued: true, width: rightW, lineGap: 1.5 });
    doc.font("regular").fillColor("#374151").text(v, { width: rightW, lineGap: 1.5 });
    ry = doc.y + 2;
  }
  y = Math.max(by, ry) + 24;

  // ---------- Items ----------
  const cols = { no: PAGE.m + 4, product: PAGE.m + 44, qty: PAGE.m + 300, unit: PAGE.m + 360, total: PAGE.m + 440 };
  const W = { no: 36, product: 250, qty: 50, unit: 78, total: CONTENT_W - 444 };
  const tableHeader = (top: number) => {
    text("S.No", cols.no, top, { bold: true, size: 9 });
    text("Product", cols.product, top, { bold: true, size: 9 });
    text("Quantity", cols.qty, top, { bold: true, size: 9, width: W.qty, align: "center" });
    text("Unit price", cols.unit, top, { bold: true, size: 9, width: W.unit, align: "right" });
    text("Total price", cols.total, top, { bold: true, size: 9, width: W.total, align: "right" });
    rule(top + 20);
    return top + 28;
  };
  const newPage = () => {
    doc.addPage();
    return PAGE.m;
  };
  y = tableHeader(y);
  inv.items.forEach((it, i) => {
    const sub = [it.variantLabel, it.sku].filter(Boolean).join(" · ");
    const h = heightOf(it.name, W.product) + (sub ? heightOf(sub, W.product, 8) : 0) + 14;
    if (y + h > BOTTOM) y = tableHeader(newPage());
    text(String(i + 1), cols.no, y);
    let py = text(it.name, cols.product, y, { width: W.product });
    if (sub) py = text(sub, cols.product, py, { width: W.product, size: 8, color: MUTED });
    text(String(it.quantity), cols.qty, y, { width: W.qty, align: "center" });
    text(money(it.unitPrice), cols.unit, y, { width: W.unit, align: "right" });
    text(money(it.total), cols.total, y, { width: W.total, align: "right" });
    y = Math.max(py, y + 12) + 7;
    rule(y - 3);
  });

  // ---------- Totals ----------
  const rows: { label: string; value: string; strong?: boolean; color?: string }[] = [
    { label: "Subtotal", value: money(inv.subtotal) },
    ...(inv.discount > 0 ? [{ label: `Discount${inv.couponCode ? ` (${inv.couponCode})` : ""}`, value: `− ${money(inv.discount)}`, color: "#15803d" }] : []),
    { label: "Shipping", value: inv.shipping > 0 ? money(inv.shipping) : "Free shipping" },
    ...(inv.tax > 0 ? [{ label: "Tax", value: money(inv.tax) }] : []),
    { label: "Total", value: money(inv.total), strong: true },
    { label: "Amount paid", value: money(inv.amountPaid) },
    ...(inv.refunded > 0 ? [{ label: "Refunded", value: `− ${money(inv.refunded)}` }] : []),
    ...(inv.balanceDue > 0 ? [{ label: inv.paymentMethod === "cod" ? "Balance due on delivery" : "Balance due", value: money(inv.balanceDue), strong: true, color: ACCENT }] : []),
  ];
  const totalsH = rows.length * 22 + 10;
  if (y + totalsH > BOTTOM) y = newPage();
  const tx = PAGE.m + CONTENT_W * 0.5;
  const tw = CONTENT_W * 0.5;
  y += 6;
  for (const r of rows) {
    if (r.strong && r.label === "Total") rule(y - 4, tx);
    text(r.label, tx + 4, y, { size: r.strong ? 11 : 9.5, color: r.strong ? INK : "#374151", width: tw * 0.6 });
    text(r.value, tx + tw * 0.45, y, { size: r.strong ? 11 : 9.5, bold: r.strong, color: r.color ?? INK, width: tw * 0.55 - 4, align: "right" });
    y += r.strong ? 24 : 20;
  }

  // ---------- Footer ----------
  const site = inv.business.website;
  const footer = [
    `Thank you for shopping with ${inv.business.name}!`,
    `Questions about this order? Call ${inv.business.phone} or email ${inv.business.email}.`,
    ...(site ? [`Shipping, return & refund policy: ${site}/policies/shipping-return-refund`, `Terms & conditions: ${site}/policies/terms`] : []),
    "This is a computer-generated invoice and does not need a signature.",
  ];
  const footerH = footer.reduce((h, l, i) => h + heightOf(l, CONTENT_W, i === 0 ? 11 : 8.5, i === 0) + 3, 0) + 20;
  y += 18;
  if (y + footerH > BOTTOM) y = newPage();
  rule(y);
  y += 12;
  footer.forEach((l, i) => {
    y = text(l, PAGE.m, y, { width: CONTENT_W, align: "center", size: i === 0 ? 11 : 8.5, bold: i === 0, color: i === 0 ? INK : MUTED }) + 3;
  });

  // ---------- Page numbers (only when there is more than one page) ----------
  const range = doc.bufferedPageRange();
  if (range.count > 1) {
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      // Writing inside the bottom margin would otherwise make pdfkit start another page.
      const saved = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      text(`Page ${i + 1} of ${range.count}  ·  ${inv.invoiceNumber}`, PAGE.m, PAGE.h - PAGE.m + 6, { width: CONTENT_W, align: "center", size: 8, color: MUTED });
      doc.page.margins.bottom = saved;
    }
  }

  doc.end();
  return done;
}
