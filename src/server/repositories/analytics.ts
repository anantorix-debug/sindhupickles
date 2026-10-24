import "server-only";
import type {
  ActivityItem,
  CategoryShare,
  DashboardData,
  DashboardKpi,
  PaymentMethod,
  ReportsData,
  RevenuePoint,
  TopProduct,
} from "@/types";
import { iso, query, type Row } from "@/server/db";
import { toRupees } from "@/server/money";
import { PLACED_ORDER_SQL, REVENUE_ORDER_SQL } from "@/server/repositories/revenue";
import { listOrders } from "@/server/repositories/orders";
import { stockLevelOf } from "@/server/repositories/products";

const DAY = 86_400_000;
const num = (v: unknown) => Number(v ?? 0);

async function categoryShare(): Promise<CategoryShare[]> {
  const rows = await query(
    `SELECT c.name AS category, SUM(oi.line_total_paise) AS paise
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE ${REVENUE_ORDER_SQL}
     GROUP BY category ORDER BY paise DESC`,
  );
  return rows.map((r) => ({ category: r.category as string, revenue: toRupees(num(r.paise)) }));
}

async function topProducts(limit: number): Promise<TopProduct[]> {
  const rows = await query(
    `SELECT oi.product_id, MAX(oi.product_name) AS name, SUM(oi.quantity) AS units, SUM(oi.line_total_paise) AS paise
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE ${REVENUE_ORDER_SQL} AND oi.product_id IS NOT NULL
     GROUP BY oi.product_id ORDER BY paise DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    productId: String(r.product_id),
    name: r.name,
    unitsSold: num(r.units),
    revenue: toRupees(num(r.paise)),
  }));
}

async function dailySeries(days: number): Promise<RevenuePoint[]> {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - (days - 1) * DAY);
  const rows = await query(
    `SELECT DATE_FORMAT(o.placed_at, '%Y-%m-%d') AS d, SUM(o.total_paise) AS paise, COUNT(*) AS n
     FROM orders o WHERE ${REVENUE_ORDER_SQL} AND o.placed_at >= ? GROUP BY d`,
    [start],
  );
  const byDay = new Map(rows.map((r) => [r.d as string, r]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(start.getTime() + i * DAY);
    const hit = byDay.get(day.toISOString().slice(0, 10));
    return {
      label: day.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }),
      revenue: hit ? toRupees(num(hit.paise)) : 0,
      orders: hit ? num(hit.n) : 0,
    };
  });
}

async function monthlySeries(months: number): Promise<RevenuePoint[]> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const rows = await query(
    `SELECT DATE_FORMAT(o.placed_at, '%Y-%m') AS m, SUM(o.total_paise) AS paise, COUNT(*) AS n
     FROM orders o WHERE ${REVENUE_ORDER_SQL} AND o.placed_at >= ? GROUP BY m`,
    [start],
  );
  const byMonth = new Map(rows.map((r) => [r.m as string, r]));
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const hit = byMonth.get(d.toISOString().slice(0, 7));
    return {
      label: d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }),
      revenue: hit ? toRupees(num(hit.paise)) : 0,
      orders: hit ? num(hit.n) : 0,
    };
  });
}

const pct = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null);

async function kpis(): Promise<DashboardKpi[]> {
  const now = Date.now();
  const d30 = new Date(now - 30 * DAY);
  const d60 = new Date(now - 60 * DAY);
  const [[cur], [prev], [cust]] = await Promise.all([
    query(
      `SELECT COUNT(*) AS orders, SUM(CASE WHEN ${REVENUE_ORDER_SQL} THEN 1 ELSE 0 END) AS paid,
              COALESCE(SUM(CASE WHEN ${REVENUE_ORDER_SQL} THEN o.total_paise END), 0) AS paise
       FROM orders o WHERE ${PLACED_ORDER_SQL} AND o.placed_at >= ?`,
      [d30],
    ),
    query(
      `SELECT COUNT(*) AS orders, SUM(CASE WHEN ${REVENUE_ORDER_SQL} THEN 1 ELSE 0 END) AS paid,
              COALESCE(SUM(CASE WHEN ${REVENUE_ORDER_SQL} THEN o.total_paise END), 0) AS paise
       FROM orders o WHERE ${PLACED_ORDER_SQL} AND o.placed_at >= ? AND o.placed_at < ?`,
      [d60, d30],
    ),
    query(`SELECT COUNT(*) AS total, SUM(created_at >= ?) AS recent, SUM(created_at >= ? AND created_at < ?) AS prior FROM customers`, [d30, d60, d30]),
  ]);
  const aov = (r: Row) => (num(r.paid) ? toRupees(num(r.paise) / num(r.paid)) : 0);
  return [
    { key: "revenue", label: "Revenue · 30 days", value: toRupees(num(cur.paise)), format: "currency", changePct: pct(num(cur.paise), num(prev.paise)) },
    { key: "orders", label: "Orders · 30 days", value: num(cur.orders), format: "number", changePct: pct(num(cur.orders), num(prev.orders)) },
    { key: "customers", label: "Customers", value: num(cust.total), format: "number", changePct: pct(num(cust.recent), num(cust.prior)) },
    { key: "aov", label: "Avg. order value", value: aov(cur), format: "currency", changePct: pct(aov(cur), aov(prev)) },
  ];
}

async function activity(): Promise<ActivityItem[]> {
  const [events, lowStock] = await Promise.all([
    query(
      `SELECT e.id, e.message, e.created_at, o.order_number
       FROM order_events e JOIN orders o ON o.id = e.order_id ORDER BY e.created_at DESC, e.id DESC LIMIT 5`,
    ),
    query(
      `SELECT v.id, v.label, p.name, i.on_hand - i.reserved AS available, i.low_stock_threshold AS threshold, i.updated_at
       FROM inventory i JOIN product_variants v ON v.id = i.variant_id JOIN products p ON p.id = v.product_id
       WHERE v.active = 1 AND i.on_hand - i.reserved <= i.low_stock_threshold ORDER BY available LIMIT 3`,
    ),
  ]);
  const items: ActivityItem[] = [
    ...events.map((e): ActivityItem => ({ id: `e${e.id}`, kind: "order", message: `${e.order_number}: ${e.message}`, at: iso(e.created_at)! })),
    ...lowStock.map(
      (s): ActivityItem => ({
        id: `s${s.id}`,
        kind: "stock",
        message: `${s.name} (${s.label}) is ${stockLevelOf(s.available, s.threshold) === "out" ? "out of stock" : `low — ${s.available} left`}`,
        at: iso(s.updated_at)!,
      }),
    ),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
}

export async function getDashboard(): Promise<DashboardData> {
  const [k, series, share, top, recentOrders, act] = await Promise.all([
    kpis(),
    dailySeries(14),
    categoryShare(),
    topProducts(5),
    listOrders({ limit: 6 }),
    activity(),
  ]);
  return { kpis: k, revenueSeries: series, categoryShare: share, topProducts: top, recentOrders, activity: act };
}

export async function getReports(): Promise<ReportsData> {
  const [monthly, share, top, mix, [totals], [refunds]] = await Promise.all([
    monthlySeries(6),
    categoryShare(),
    topProducts(8),
    query(
      `SELECT o.payment_method AS method, SUM(o.total_paise) AS paise FROM orders o WHERE ${REVENUE_ORDER_SQL} GROUP BY o.payment_method ORDER BY paise DESC`,
    ),
    query(`SELECT COUNT(*) AS n, COALESCE(SUM(o.total_paise), 0) AS paise FROM orders o WHERE ${REVENUE_ORDER_SQL}`),
    query(`SELECT COALESCE(SUM(amount_refunded_paise), 0) AS paise FROM payments`),
  ]);
  return {
    monthly,
    categoryShare: share,
    topProducts: top,
    paymentMix: mix.map((m) => ({ method: String(m.method).toLowerCase() as PaymentMethod, amount: toRupees(num(m.paise)) })),
    totals: {
      revenue: toRupees(num(totals.paise)),
      orders: num(totals.n),
      refunds: toRupees(num(refunds.paise)),
      aov: num(totals.n) ? toRupees(num(totals.paise) / num(totals.n)) : 0,
    },
  };
}
