import "server-only";
import type { PoolConnection } from "mysql2/promise";
import type { Address } from "@/types";
import type { AddressInput } from "@/lib/validation/store";
import { ApiError, notFound } from "@/server/http";
import { query, transaction, type Row } from "@/server/db";

const MAX_ADDRESSES = 10;

const SELECT_ADDRESSES = `
  SELECT a.*, d.area, d.district FROM addresses a LEFT JOIN address_details d ON d.address_id = a.id`;

const mapAddress = (a: Row): Address => ({
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
});

export async function listAddresses(customerId: string): Promise<Address[]> {
  return (await query(`${SELECT_ADDRESSES} WHERE a.customer_id = ? ORDER BY a.is_default DESC, a.id DESC`, [customerId])).map(mapAddress);
}

export async function getAddress(customerId: string, id: string): Promise<Address | null> {
  const [row] = await query(`${SELECT_ADDRESSES} WHERE a.customer_id = ? AND a.id = ?`, [customerId, id]);
  return row ? mapAddress(row) : null;
}

/** Shared with checkout so a new address entered there is saved the same way. */
export async function insertAddress(conn: PoolConnection, customerId: string, input: AddressInput): Promise<string> {
  const [count] = await conn.query<Row[]>("SELECT COUNT(*) AS n FROM addresses WHERE customer_id = ? FOR UPDATE", [customerId]);
  const existing = Number(count[0].n);
  if (existing >= MAX_ADDRESSES) throw new ApiError(422, `You can save up to ${MAX_ADDRESSES} addresses`, "too_many_addresses");

  const makeDefault = input.isDefault || existing === 0;
  if (makeDefault) await conn.query("UPDATE addresses SET is_default = 0 WHERE customer_id = ?", [customerId]);

  const [res] = await conn.query<import("mysql2").ResultSetHeader>(
    `INSERT INTO addresses (customer_id, label, full_name, phone, line1, line2, landmark, city, state, pincode, country, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'India', ?, NOW(3), NOW(3))`,
    [
      customerId, input.type, input.fullName, input.phone, input.line1, input.line2 || null, input.landmark || null,
      input.city, input.state, input.pincode, makeDefault ? 1 : 0,
    ],
  );
  await conn.query("INSERT INTO address_details (address_id, area, district) VALUES (?, ?, ?)", [res.insertId, input.area, input.district]);
  return String(res.insertId);
}

export async function createAddress(customerId: string, input: AddressInput): Promise<Address> {
  const id = await transaction((conn) => insertAddress(conn, customerId, input));
  return (await getAddress(customerId, id))!;
}

export async function updateAddress(customerId: string, id: string, input: AddressInput): Promise<Address> {
  await transaction(async (conn) => {
    const [rows] = await conn.query<Row[]>("SELECT id, is_default FROM addresses WHERE id = ? AND customer_id = ? FOR UPDATE", [id, customerId]);
    if (!rows[0]) throw notFound("Address");
    // The default can only move by choosing another address as the default.
    const makeDefault = input.isDefault || Boolean(rows[0].is_default);
    if (makeDefault) await conn.query("UPDATE addresses SET is_default = 0 WHERE customer_id = ?", [customerId]);
    await conn.query(
      `UPDATE addresses SET label = ?, full_name = ?, phone = ?, line1 = ?, line2 = ?, landmark = ?, city = ?, state = ?, pincode = ?,
              is_default = ?, updated_at = NOW(3) WHERE id = ?`,
      [input.type, input.fullName, input.phone, input.line1, input.line2 || null, input.landmark || null, input.city, input.state, input.pincode, makeDefault ? 1 : 0, id],
    );
    await conn.query(
      "INSERT INTO address_details (address_id, area, district) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE area = VALUES(area), district = VALUES(district)",
      [id, input.area, input.district],
    );
  });
  return (await getAddress(customerId, id))!;
}

export async function setDefaultAddress(customerId: string, id: string): Promise<void> {
  await transaction(async (conn) => {
    const [rows] = await conn.query<Row[]>("SELECT id FROM addresses WHERE id = ? AND customer_id = ? FOR UPDATE", [id, customerId]);
    if (!rows[0]) throw notFound("Address");
    await conn.query("UPDATE addresses SET is_default = (id = ?) WHERE customer_id = ?", [id, customerId]);
  });
}

/** Deleting the default promotes the most recent remaining address. Past orders keep their own address snapshot. */
export async function deleteAddress(customerId: string, id: string): Promise<void> {
  await transaction(async (conn) => {
    const [rows] = await conn.query<Row[]>("SELECT id, is_default FROM addresses WHERE id = ? AND customer_id = ? FOR UPDATE", [id, customerId]);
    if (!rows[0]) throw notFound("Address");
    await conn.query("DELETE FROM addresses WHERE id = ?", [id]);
    if (rows[0].is_default) {
      await conn.query("UPDATE addresses SET is_default = 1 WHERE customer_id = ? ORDER BY id DESC LIMIT 1", [customerId]);
    }
  });
}
