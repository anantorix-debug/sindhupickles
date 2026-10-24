import type { Metadata } from "next";
import { AddressManager } from "@/components/store/account/address-manager";
import { listAddresses } from "@/server/store/addresses";
import { requireCustomerPage } from "@/server/store/page-auth";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const me = await requireCustomerPage("/account/addresses");
  return <AddressManager addresses={await listAddresses(me.id)} />;
}
