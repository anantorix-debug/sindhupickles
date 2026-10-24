import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/layout/admin-shell";
import { QueryProvider } from "@/components/admin/layout/query-provider";
import { getCurrentAdmin } from "@/server/repositories/admin-users";
import { getDashboard } from "@/server/repositories/analytics";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin · Sindhu's Pickles" },
  robots: { index: false, follow: false },
};

// Every admin page reads live database data — never prerender at build time.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [user, dashboard] = await Promise.all([getCurrentAdmin(), getDashboard()]);

  return (
    <QueryProvider>
      <AdminShell user={user} notifications={dashboard.activity.slice(0, 4)}>
        {children}
      </AdminShell>
    </QueryProvider>
  );
}
