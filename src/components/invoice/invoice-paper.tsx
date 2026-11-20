import Image from "next/image";
import { orderStatusMeta, paymentStatusMeta } from "@/config/labels";
import { compactAddress } from "@/lib/invoice-format";
import type { Invoice } from "@/types";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: number) => inr.format(v);
const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).replace(/\//g, "-");

/** On-screen preview of the invoice, in the same design as the PDF (server/invoices/pdf.ts). */
export function InvoicePaper({ invoice: inv }: { invoice: Invoice }) {
  const closed = ["cancelled", "refunded", "returned"].includes(inv.orderStatus);
  const stamp = closed
    ? { label: orderStatusMeta[inv.orderStatus].label, tone: "border-red-700 text-red-700" }
    : inv.balanceDue === 0 && inv.amountPaid > 0
      ? { label: "Paid", tone: "border-green-700 text-green-700" }
      : { label: inv.paymentMethod === "cod" ? "Pay on delivery" : "Payment due", tone: "border-[#b45309] text-[#b45309]" };
  const shipsElsewhere = !(inv.sameAddress && inv.shipTo.name === inv.billTo.name);
  const site = inv.business.website;

  return (
    <article aria-label={`Invoice ${inv.invoiceNumber}`} className="mx-auto w-full max-w-[820px] overflow-hidden rounded-md bg-white text-[13px] leading-relaxed text-gray-700 shadow-card">
      <header className="flex flex-col gap-4 border-b-[3px] border-[#f59e0b] bg-[#1c1916] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div className="flex items-center gap-4">
          <Image src="/assets/images/logo.webp" alt="" width={490} height={640} className="h-20 w-auto" />
          <div>
            <p className="text-xl font-bold text-[#faf8f5]">{inv.business.name}</p>
            {site && <p className="text-xs text-[#f59e0b]">{site.replace(/^https?:\/\//, "")}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-3xl font-bold tracking-[0.2em] text-[#f59e0b]">INVOICE</p>
          <p className="font-bold text-[#faf8f5]">{inv.invoiceNumber}</p>
          <p className="text-xs text-[#c9bfb4]">Issued {date(inv.invoiceDate)}</p>
        </div>
      </header>

      <div className="space-y-8 p-6 sm:p-10">
        <section className="grid gap-3 sm:grid-cols-3">
          <Card title="Billed to" edge="border-l-[#b45309]">
            <p className="font-bold text-gray-900">{inv.billTo.name}</p>
            {compactAddress(inv.billTo.addressLines).map((l, i) => <p key={i}>{l}</p>)}
            {inv.billTo.phone && <p>{inv.billTo.phone}</p>}
            {inv.billTo.email && <p className="break-words">{inv.billTo.email}</p>}
            {shipsElsewhere ? (
              <>
                <p className="mt-1 text-[11px] font-bold text-[#b45309]">Ship to</p>
                <p>{[inv.shipTo.name, ...compactAddress(inv.shipTo.addressLines), inv.shipTo.phone].filter(Boolean).join(", ")}</p>
              </>
            ) : (
              <p className="mt-1 text-[11px] text-gray-500">Ships to this address</p>
            )}
          </Card>
          <Card title="From" edge="border-l-[#b45309]">
            <p className="font-bold text-gray-900">{inv.business.name}</p>
            {compactAddress(inv.business.addressLines).map((l) => <p key={l}>{l}</p>)}
            <p>{inv.business.phone}</p>
            <p className="break-words">{inv.business.email}</p>
            {inv.business.gstin && <p className="font-bold text-gray-900">GSTIN: {inv.business.gstin}</p>}
          </Card>
          <Card title="Order details" edge="border-l-[#f59e0b]">
            <dl className="space-y-1">
              {(
                [
                  ["Order no", inv.orderNumber],
                  ["Order date", date(inv.orderDate)],
                  ["Invoice date", date(inv.invoiceDate)],
                  ["Payment", inv.paymentMethodLabel],
                  ["Status", paymentStatusMeta[inv.paymentStatus]?.label ?? inv.paymentStatus],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-xs text-gray-500">{k}</dt>
                  <dd className="text-right text-xs font-bold text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <caption className="sr-only">Items</caption>
            <thead>
              <tr className="bg-[#78350f] text-[11px] font-bold uppercase tracking-wider text-[#faf8f5]">
                <th scope="col" className="w-10 rounded-l-md py-2.5 pl-3">#</th>
                <th scope="col" className="py-2.5 pr-2">Product</th>
                <th scope="col" className="py-2.5 pr-2 text-center">Qty</th>
                <th scope="col" className="py-2.5 pr-2 text-right">Unit price</th>
                <th scope="col" className="rounded-r-md py-2.5 pr-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={i} className={`align-top ${i % 2 ? "bg-[#fbf6ee]" : ""}`}>
                  <td className="py-2.5 pl-3 text-xs text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="py-2.5 pr-2 text-gray-900">
                    {it.name}
                    <span className="block text-[11px] text-gray-500">{[it.variantLabel, it.sku].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="py-2.5 pr-2 text-center">{it.quantity}</td>
                  <td className="whitespace-nowrap py-2.5 pr-2 text-right">{money(it.unitPrice)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right font-bold text-gray-900">{money(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="flex flex-col-reverse items-center gap-8 border-t border-[#efe4d3] pt-6 sm:flex-row sm:items-start sm:justify-between">
          <p className={`-rotate-[10deg] rounded-md border-[3px] px-5 py-2 text-lg font-bold uppercase tracking-[0.2em] opacity-85 outline outline-1 outline-offset-[-7px] sm:mt-8 sm:ml-12 ${stamp.tone}`}>
            {stamp.label}
          </p>
          <dl className="w-full max-w-xs space-y-2">
            <Row label="Subtotal" value={money(inv.subtotal)} />
            {inv.discount > 0 && <Row label={`Discount${inv.couponCode ? ` (${inv.couponCode})` : ""}`} value={`− ${money(inv.discount)}`} tone="text-green-700" />}
            <Row label="Shipping" value={inv.shipping > 0 ? money(inv.shipping) : "Free"} />
            {inv.tax > 0 && <Row label="Tax" value={money(inv.tax)} />}
            <div className="flex items-center justify-between rounded-md bg-[#b45309] px-3 py-2 text-[#faf8f5]">
              <dt className="text-xs font-bold uppercase tracking-[0.15em]">Total</dt>
              <dd className="text-lg font-bold">{money(inv.total)}</dd>
            </div>
            <Row label="Amount paid" value={money(inv.amountPaid)} />
            {inv.refunded > 0 && <Row label="Refunded" value={`− ${money(inv.refunded)}`} />}
            {inv.balanceDue > 0 && <Row label={inv.paymentMethod === "cod" ? "Due on delivery" : "Balance due"} value={money(inv.balanceDue)} strong />}
          </dl>
        </section>

        <footer className="space-y-1 text-center text-xs text-gray-500">
          <span aria-hidden className="mx-auto mb-3 block h-0.5 w-11 bg-[#f59e0b]" />
          <p className="text-base font-bold text-[#78350f]">Thank you for choosing {inv.business.name}!</p>
          <p>Questions about this order? Call {inv.business.phone} or email {inv.business.email}.</p>
          {site && (
            <>
              <p>Shipping, return &amp; refund policy: {site}/policies/shipping-return-refund</p>
              <p>Terms &amp; conditions: {site}/policies/terms</p>
            </>
          )}
          <p>This is a computer-generated invoice and does not need a signature.</p>
        </footer>
      </div>

      <div className="flex flex-wrap justify-between gap-2 bg-[#1c1916] px-6 py-2 text-[11px] text-[#c9bfb4] sm:px-10">
        <span>{[site?.replace(/^https?:\/\//, ""), inv.business.phone, inv.business.email].filter(Boolean).join("  ·  ")}</span>
        <span className="font-bold text-[#f59e0b]">{inv.invoiceNumber}</span>
      </div>
    </article>
  );
}

function Card({ title, edge, children }: { title: string; edge: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-md border-l-[3px] bg-[#fbf6ee] p-3.5 text-xs leading-relaxed ${edge}`}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#b45309]">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value, tone, strong }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 px-3 ${strong ? "font-bold text-[#78350f]" : ""}`}>
      <dt>{label}</dt>
      <dd className={`whitespace-nowrap ${tone ?? (strong ? "" : "text-gray-900")}`}>{value}</dd>
    </div>
  );
}
