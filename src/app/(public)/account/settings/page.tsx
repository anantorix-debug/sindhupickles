import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/store/forms/settings-forms";
import { requireCustomerPage } from "@/server/store/page-auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireCustomerPage("/account/settings");
  // The "Notification preferences" card (<PreferencesForm initial={me.preferences} />) is hidden until order-status
  // and offer emails are sent; its component and API are kept so it can be switched back on here.
  return (
    <div className="space-y-6">
      <ChangePasswordForm />
    </div>
  );
}
