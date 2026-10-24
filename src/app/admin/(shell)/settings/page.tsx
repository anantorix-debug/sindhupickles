import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/common/page-header";
import { SettingsForm } from "@/components/admin/forms/settings-form";
import { getSettings } from "@/server/repositories/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Store details, shipping rules and notifications." />
      <div className="max-w-4xl">
        <SettingsForm settings={settings} />
      </div>
    </>
  );
}
