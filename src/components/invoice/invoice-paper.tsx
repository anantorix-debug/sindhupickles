import Image from "next/image";
import { orderStatusMeta, paymentStatusMeta } from "@/config/labels";
import type { Invoice } from "@/types";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: number) => inr.format(v);
const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).replace(/\//g, "-");

/** On-screen preview of the invoice, laid out like the PDF (a white A4-width sheet on any theme). */
export function InvoicePaper({ invoice: inv }: { invoice: Invoice }) {
  const closed = ["cancelled", "refunded", "returned"].includes(inv.orderStatus);
  const totals: { label: string; value: string; strong?: boolean; tone?: string }[] = [
    { label: "Subtotal", value: money(inv.subtotal) },
    ...(inv.discount > 0 ? [{ label: `Discount${inv.couponCode ? ` (${inv.couponCode})` : ""}`, value: `− ${money(inv.discount)}`, tone: "text-green-700" }] : []),
    { label: "Shipping", value: inv.shipping > 0 ? money(inv.shipping) : "Free shipping" },
    ...(inv.tax > 0 ? [{ label: "Tax", value: money(inv.tax) }] : []),
    { label: "Total", value: money(inv.total), strong: true },
    { label: "Amount paid", value: money(inv.amountPaid) },
    ...(inv.refunded > 0 ? [{ label: "Refunded", value: `− ${money(inv.refunded)}` }] : []),
    ...(inv.balanceDue > 0
      ? [{ label: inv.paymentMethod === "cod" ? "Balance due on delivery" : "Balance due", value: money(inv.balanceDue), strong: true, tone: "text-orange-800" }]
      : []),
  ];

  return (
    <article aria-label={`Invoice ${inv.invoiceNumber}`} className="mx-auto w-full max-w-[820px] rounded-md bg-white p-6 text-[13px] leading-relaxed text-gray-800 shadow-card sm:p-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div>
          <p className="flex items-center gap-3 text-3xl font-bold tracking-tight text-gray-900">
            INVOICE
            {closed && <span className="rounded-sm border border-red-700 px-2 py-0.5 text-xs font-bold uppercase text-red-700">{orderStatusMeta[inv.orderStatus].label}</span>}
          </p>
          <Image src="/assets/images/logo.webp" alt={inv.business.name} width={490} height={640} className="mt-3 h-24 w-auto" />
        </div>
        <address className="not-italic sm:w-[40%]">
          <p className="font-bold text-gray-900">From</p>
          <p>{inv.business.name}</p>
          {inv.business.addressLines.map((l) => <p key={l}>{l}</p>)}
          <p>{inv.business.phone}</p>
          <p className="break-all">{inv.business.email}</p>
          {inv.business.gstin && <p>GSTIN: {inv.business.gstin}</p>}
        </address>
      </header>

      <section className="mt-8 flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div className="sm:w-1/2">
          <p className="font-bold text-gray-900">Bill to</p>
          <p>{inv.billTo.name}</p>
          {inv.billTo.addressLines.map((l, i) => <p key={i}>{l}</p>)}
          <p className="break-all">{inv.billTo.email}</p>
          <p>{inv.billTo.phone}</p>
          <p className="mt-3 font-bold text-gray-900">Ship to</p>
          {inv.sameAddress && inv.shipTo.name === inv.billTo.name ? (
            <p className="text-gray-500">Same as billing address</p>
          ) : (
            <>
              <p>{inv.shipTo.name}</p>
              {inv.shipTo.addressLines.map((l, i) => <p key={i}>{l}</p>)}
              <p>{inv.shipTo.phone}</p>
            </>
          )}
        </div>
        <dl className="space-y-0.5 sm:w-[40%]">
          <div className="mb-1 text-xl text-gray-900">
            <dt className="inline font-bold">Invoice no: </dt>
            <dd className="inline">{inv.invoiceNumber}</dd>
          </div>
          {(
            [
              ["Order no:", inv.orderNumber],
              ["Invoice date:", date(inv.invoiceDate)],
              ["Order date:", date(inv.orderDate)],
              ["Payment method:", inv.paymentMethodLabel],
              ["Payment status:", paymentStatusMeta[inv.paymentStatus]?.label ?? inv.paymentStatus],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-bold text-gray-900">{k} </dt>
              <dd className="inline">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <caption className="sr-only">Items</caption>
          <thead>
            <tr className="border-b border-gray-200 text-xs font-bold text-gray-900">
              <th scope="col" className="w-12 py-2 pr-2">S.No</th>
              <th scope="col" className="py-2 pr-2">Product</th>
              <th scope="col" className="py-2 pr-2 text-center">Quantity</th>
              <th scope="col" className="py-2 pr-2 text-right">Unit price</th>
              <th scope="col" className="py-2 text-right">Total price</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} className="border-b border-gray-200 align-top">
                <td className="py-2.5 pr-2">{i + 1}</td>
                <td className="py-2.5 pr-2">
                  {it.name}
                  <span className="block text-xs text-gray-500">{[it.variantLabel, it.sku].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="py-2.5 pr-2 text-center">{it.quantity}</td>
                <td className="whitespace-nowrap py-2.5 pr-2 text-right">{money(it.unitPrice)}</td>
                <td className="whitespace-nowrap py-2.5 text-right">{money(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto mt-4 w-full max-w-sm space-y-2">
        {totals.map((t) => (
          <div key={t.label} className={`flex justify-between gap-4 ${t.label === "Total" ? "border-t border-gray-200 pt-2" : ""} ${t.strong ? "text-base font-bold text-gray-900" : ""}`}>
            <dt>{t.label}</dt>
            <dd className={`whitespace-nowrap ${t.tone ?? ""}`}>{t.value}</dd>
          </div>
        ))}
      </dl>

      <footer className="mt-10 space-y-1 border-t border-gray-200 pt-4 text-center text-xs text-gray-500">
        <p className="text-sm font-bold text-gray-900">Thank you for shopping with {inv.business.name}!</p>
        <p>Questions about this order? Call {inv.business.phone} or email {inv.business.email}.</p>
        {inv.business.website && (
          <p>
            Shipping, return &amp; refund policy: {inv.business.website}/policies/shipping-return-refund · Terms: {inv.business.website}/policies/terms
          </p>
        )}
        <p>This is a computer-generated invoice and does not need a signature.</p>
      </footer>
    </article>
  );
}
