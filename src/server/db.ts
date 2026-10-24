import "server-only";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

const globalForDb = globalThis as unknown as { __pool?: Pool };

function createPool(): Pool {
  return mysql.createPool({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME ?? "sindhu",
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    connectionLimit: 10,
    timezone: "Z", // DATETIME columns hold UTC
    decimalNumbers: true,
  });
}

function createUtcPool(): Pool {
  const p = createPool();
  // `timezone: "Z"` only converts JS Dates. The MySQL server here runs in IST, so NOW() would
  // otherwise return local time and disagree with JS Dates (e.g. password-reset expiry). Pin
  // every connection's session to UTC so NOW() and JS Dates share one clock.
  p.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return p;
}

/** One pool per process (survives dev hot-reloads). */
export const pool = (globalForDb.__pool ??= createUtcPool());

export type Row = RowDataPacket;

export async function query<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query<T[]>(sql, params);
  return rows;
}

export async function execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [res] = await pool.query<ResultSetHeader>(sql, params);
  return res;
}

export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export const iso = (d: Date | string | null): string | null => (d ? new Date(d).toISOString() : null);

/**
 * JSON columns come back as parsed objects from MySQL but as plain text from MariaDB (where JSON is just
 * LONGTEXT). Reading them through this keeps the app working on either server.
 */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value as T | null | undefined) ?? fallback;
}
