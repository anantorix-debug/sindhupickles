import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/common/page-header";
import { CustomersTable } from "@/components/admin/tables/customers-table";
import { listCustomers } from "@/server/repositories/customers";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const customers = await listCustomers();
  return (
    <>
      <PageHeader title="Customers" description={`${customers.length} registered customers.`} />
      <CustomersTable customers={customers} />
    </>
  );
}
