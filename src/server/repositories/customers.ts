import "server-only";
import type { Address, Customer, CustomerStatus } from "@/types";
import { iso, query, type Row } from "@/server/db";
import { toRupees } from "@/server/money";
import { PLACED_ORDER_SQL, REVENUE_ORDER_SQL } from "@/server/repositories/revenue";

const SELECT_CUSTOMERS = `
  SELECT c.*,
    (SELECT a.city  FROM addresses a WHERE a.customer_id = c.id ORDER BY a.is_default DESC, a.id LIMIT 1) AS city,
    (SELECT a.state FROM addresses a WHERE a.customer_id = c.id ORDER BY a.is_default DESC, a.id LIMIT 1) AS state,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND ${PLACED_ORDER_SQL}) AS orders_count,
    (SELECT COALESCE(SUM(o.total_paise), 0) FROM orders o WHERE o.customer_id = c.id AND ${REVENUE_ORDER_SQL}) AS spent_paise,
    (SELECT MAX(o.placed_at) FROM orders o WHERE o.customer_id = c.id AND ${PLACED_ORDER_SQL}) AS last_order_at
  FROM customers c`;

const mapCustomer = (r: Row): Customer => ({
  id: String(r.id),
  name: r.name,
  email: r.email,
  phone: r.phone,
  city: r.city,
  state: r.state,
  status: String(r.status).toLowerCase() as CustomerStatus,
  ordersCount: Number(r.orders_count),
  totalSpent: toRupees(Number(r.spent_paise)),
  joinedAt: iso(r.created_at)!,
  lastOrderAt: iso(r.last_order_at),
  notes: r.notes,
});

export async function listCustomers(): Promise<Customer[]> {
  return (await query(`${SELECT_CUSTOMERS} ORDER BY c.created_at DESC, c.id DESC`)).map(mapCustomer);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const [row] = await query(`${SELECT_CUSTOMERS} WHERE c.id = ?`, [id]);
  return row ? mapCustomer(row) : null;
}

/** Read-only: customers manage their own addresses (one default) on the storefront. */
export async function listAddresses(customerId: string): Promise<Address[]> {
  const rows = await query(
    "SELECT a.*, d.area, d.district FROM addresses a LEFT JOIN address_details d ON d.address_id = a.id WHERE a.customer_id = ? ORDER BY a.is_default DESC, a.id",
    [customerId],
  );
  return rows.map((a) => ({
    id: String(a.id),
    label: a.label,
    fullName: a.full_name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    area: a.area ?? null,
    district: a.district ?? null,
    landmark: a.landmark,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    country: a.country,
    isDefault: Boolean(a.is_default),
  }));
}
