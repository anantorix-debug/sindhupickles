import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/common/page-header";
import { DetailCard } from "@/components/admin/common/detail-list";
import { CustomerStatusBadge } from "@/components/admin/badges/status-badge";
import { CustomerPasswordDialog } from "@/components/admin/dialogs/customer-password";
import { OrdersTable } from "@/components/admin/tables/orders-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/admin/badges/status-badge";
import { getCustomer, listAddresses } from "@/server/repositories/customers";
import { listOrders } from "@/server/repositories/orders";
import { formatCurrency, formatDate } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/admin/customers/[id]">): Promise<Metadata> {
  const customer = await getCustomer((await params).id);
  return { title: customer?.name ?? "Customer" };
}

export default async function CustomerDetailPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();
  const [orders, addresses] = await Promise.all([listOrders({ customerId: customer.id }), listAddresses(customer.id)]);

  return (
    <>
      <PageHeader
        title={customer.name}
        description={customer.city ? `${customer.city}${customer.state ? `, ${customer.state}` : ""}` : undefined}
        backHref="/admin/customers"
        backLabel="Customers"
        actions={<CustomerPasswordDialog customerId={customer.id} customerName={customer.name} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DetailCard
            title="Profile"
            rows={[
              { label: "Email", value: customer.email },
              { label: "Phone", value: customer.phone },
              { label: "Status", value: <CustomerStatusBadge status={customer.status} /> },
              { label: "Joined", value: formatDate(customer.joinedAt) },
              { label: "Last order", value: customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "No orders yet" },
              ...(customer.notes ? [{ label: "Notes", value: customer.notes }] : []),
            ]}
          />
        </div>
        <DetailCard
          title="Lifetime value"
          rows={[
            { label: "Orders", value: customer.ordersCount },
            { label: "Total spent", value: formatCurrency(customer.totalSpent) },
          ]}
        />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          {addresses.length === 0 ? (
            <p className="text-sm text-muted">No saved addresses.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {addresses.map((a) => (
                <li key={a.id} className="rounded-md border border-border p-4 text-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-semibold">{a.label}</span>
                    {a.isDefault && <StatusBadge label="Default" tone="primary" />}
                  </div>
                  <p className="font-medium">
                    {a.fullName} · {a.phone}
                  </p>
                  <p className="text-muted">
                    {[a.line1, a.line2, a.landmark, a.city, a.state, a.pincode, a.country].filter(Boolean).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <h2 className="mb-3 mt-8 font-display text-lg font-bold">Orders</h2>
      <OrdersTable orders={orders} />
    </>
  );
}
