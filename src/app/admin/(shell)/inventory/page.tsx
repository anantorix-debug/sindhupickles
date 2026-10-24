import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/common/page-header";
import { InventoryTable } from "@/components/admin/tables/inventory-table";
import { stockLevelMeta } from "@/config/labels";
import { listInventory } from "@/server/repositories/inventory";
import type { StockLevel } from "@/types";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const items = await listInventory();
  const levels: StockLevel[] = ["in-stock", "low", "out"];

  return (
    <>
      <PageHeader title="Inventory" description="Track and adjust stock for every pack size." />
      <section aria-label="Stock summary" className="mb-6 grid gap-4 sm:grid-cols-3">
        {levels.map((l) => (
          <Card key={l} className="p-5">
            <p className="text-sm font-medium text-muted">{stockLevelMeta[l].label}</p>
            <p className="mt-2 font-display text-3xl font-black">{items.filter((i) => i.level === l).length}</p>
          </Card>
        ))}
      </section>
      <InventoryTable items={items} />
    </>
  );
}
