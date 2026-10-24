import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/common/page-header";
import { EnquiriesTable } from "@/components/admin/tables/enquiries-table";
import { listEnquiries } from "@/server/repositories/enquiries";

export const metadata: Metadata = { title: "Enquiries" };

export default async function EnquiriesPage() {
  const enquiries = await listEnquiries();
  const unread = enquiries.filter((e) => !e.isRead).length;
  return (
    <>
      <PageHeader
        title="Enquiries"
        description={unread ? `${unread} unread of ${enquiries.length}` : `${enquiries.length} messages, all read.`}
      />
      <EnquiriesTable enquiries={enquiries} />
    </>
  );
}
