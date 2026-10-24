import "server-only";
import type { InventoryItem } from "@/types";
import type { StockAdjustInput } from "@/lib/validation/api";
import { ApiError, notFound } from "@/server/http";
import { iso, query, transaction, type Row } from "@/server/db";
import { stockLevelOf } from "@/server/repositories/products";

const SELECT_INVENTORY = `
  SELECT v.id AS variant_id, v.product_id, v.sku, v.label, p.name AS product_name, c.name AS category_name,
         i.on_hand, i.reserved, i.low_stock_threshold, i.updated_at
  FROM inventory i
  JOIN product_variants v ON v.id = i.variant_id
  JOIN products p ON p.id = v.product_id
  JOIN categories c ON c.id = p.category_id`;

const mapItem = (r: Row): InventoryItem => {
  const available = r.on_hand - r.reserved;
  return {
    variantId: String(r.variant_id),
    productId: String(r.product_id),
    productName: r.product_name,
    sku: r.sku,
    label: r.label,
    category: r.category_name,
    onHand: r.on_hand,
    reserved: r.reserved,
    available,
    lowStockThreshold: r.low_stock_threshold,
    level: stockLevelOf(available, r.low_stock_threshold),
    updatedAt: iso(r.updated_at)!,
  };
};

export async function listInventory(): Promise<InventoryItem[]> {
  return (await query(`${SELECT_INVENTORY} ORDER BY p.name, v.position, v.id`)).map(mapItem);
}

export async function getInventoryItem(variantId: string): Promise<InventoryItem | null> {
  const [row] = await query(`${SELECT_INVENTORY} WHERE v.id = ?`, [variantId]);
  return row ? mapItem(row) : null;
}

/** Sets on-hand stock for a variant and records the change as an ADJUST movement. */
export async function adjustStock(variantId: string, input: StockAdjustInput): Promise<InventoryItem> {
  await transaction(async (conn) => {
    const [rows] = await conn.query<Row[]>("SELECT id, on_hand, reserved FROM inventory WHERE variant_id = ? FOR UPDATE", [variantId]);
    const inv = rows[0];
    if (!inv) throw notFound("Inventory record");
    if (input.onHand < inv.reserved) {
      throw new ApiError(422, `${inv.reserved} units are reserved by open orders, so stock can't go below that.`, "below_reserved", {
        onHand: `Must be at least ${inv.reserved} (reserved)`,
      });
    }
    const delta = input.onHand - inv.on_hand;
    if (delta === 0) return;
    await conn.query("UPDATE inventory SET on_hand = ?, updated_at = NOW(3) WHERE id = ?", [input.onHand, inv.id]);
    await conn.query(
      `INSERT INTO inventory_movements (inventory_id, type, on_hand_delta, reserved_delta, reason, order_id, actor_id, created_at)
       VALUES (?, 'ADJUST', ?, 0, ?, NULL, NULL, NOW(3))`,
      [inv.id, delta, input.reason || "Manual adjustment from admin"],
    );
  });
  return (await getInventoryItem(variantId))!;
}
