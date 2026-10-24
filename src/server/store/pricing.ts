import "server-only";
import type { CartItemInput, CartIssue, PricedCart, PricedCartLine } from "@/types/store";
import { ApiError } from "@/server/http";
import { query, type Row } from "@/server/db";
import { toRupees } from "@/server/money";
import { getSettings } from "@/server/repositories/settings";

/** Runs a query on the pool or inside a checkout transaction (where rows are locked). */
export type Querier = (sql: string, params?: unknown[]) => Promise<Row[]>;

/** One resolved cart line with integer paise, for order creation. */
export interface ResolvedLine {
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  slug: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPaise: number;
  listPaise: number;
  quantity: number;
  requestedQuantity: number;
  available: number;
  issue: CartIssue | null;
}

export interface CouponResult {
  code: string | null;
  discountPaise: number;
  error: string | null;
}

export interface ResolvedCart {
  lines: ResolvedLine[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  coupon: CouponResult;
  freeShippingThresholdPaise: number;
}

const LINE_SQL = `
  SELECT v.id AS variant_id, v.sku, v.label, v.active AS v_active, v.price_paise AS v_price, v.sale_price_paise AS v_sale,
         p.id AS product_id, p.name, p.slug, p.status, p.price_paise AS p_price, p.sale_price_paise AS p_sale, c.active AS c_active,
         COALESCE(i.on_hand, 0) - COALESCE(i.reserved, 0) AS available,
         (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id AND (pi.url LIKE '/uploads/%' OR pi.url LIKE 'https://%')
          ORDER BY pi.position, pi.id LIMIT 1) AS image_url
  FROM product_variants v
  JOIN products p ON p.id = v.product_id
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN inventory i ON i.variant_id = v.id
  WHERE v.id IN (?)`;

const MAX_PER_LINE = 20;

export async function resolveLines(items: CartItemInput[], q: Querier = query): Promise<ResolvedLine[]> {
  // Merge duplicates, preserve order.
  const wanted = new Map<string, number>();
  for (const it of items) wanted.set(it.variantId, Math.min((wanted.get(it.variantId) ?? 0) + it.quantity, MAX_PER_LINE));
  if (!wanted.size) return [];

  const rows = await q(LINE_SQL, [[...wanted.keys()]]);
  const byVariant = new Map(rows.map((r) => [String(r.variant_id), r]));

  return [...wanted].map(([variantId, requested]): ResolvedLine => {
    const r = byVariant.get(variantId);
    if (!r || !r.v_active || r.status !== "ACTIVE" || !r.c_active) {
      return {
        variantId, productId: r ? String(r.product_id) : "", sku: r?.sku ?? "", name: r?.name ?? "Unavailable product", slug: r?.slug ?? "",
        variantLabel: r?.label ?? "", imageUrl: r?.image_url ?? null, unitPaise: 0, listPaise: 0, quantity: 0, requestedQuantity: requested,
        available: 0, issue: "unavailable",
      };
    }
    const list = r.v_price === null ? r.p_price : r.v_price;
    const unit = r.v_price === null ? (r.p_sale ?? r.p_price) : (r.v_sale ?? r.v_price);
    const available = Math.max(Number(r.available), 0);
    const quantity = Math.min(requested, available);
    const issue: CartIssue | null = available === 0 ? "out_of_stock" : quantity < requested ? "reduced" : null;
    return {
      variantId, productId: String(r.product_id), sku: r.sku, name: r.name, slug: r.slug, variantLabel: r.label, imageUrl: r.image_url ?? null,
      unitPaise: unit, listPaise: list, quantity, requestedQuantity: requested, available, issue,
    };
  });
}

interface CouponRow {
  code: string;
  type: string;
  value: number;
  min_subtotal_paise: number;
  max_discount_paise: number | null;
}

/**
 * Validates a coupon against the `coupons` table. All checks happen on the server; the
 * welcome coupon from Settings is first-order only.
 */
export async function evaluateCoupon(
  code: string | undefined,
  subtotalPaise: number,
  customerId: string | null,
  q: Querier = query,
): Promise<CouponResult> {
  if (!code) return { code: null, discountPaise: 0, error: null };
  const fail = (error: string): CouponResult => ({ code: null, discountPaise: 0, error });

  const { welcomeCoupon, welcomeCouponPct } = await getSettings();
  const load = async () =>
    ((await q(
      `SELECT code, type, value, min_subtotal_paise, max_discount_paise, active, expires_at, usage_limit, used_count
       FROM coupons WHERE code = ?`,
      [code],
    )) as (Row & CouponRow)[])[0];

  let c = await load();
  // The welcome offer shown on the site is defined in Admin → Settings. A fresh database has no coupon rows, so the
  // row is created the first time that code is used (never replaced or edited once it exists).
  if (!c && welcomeCoupon && code.trim().toUpperCase() === welcomeCoupon.toUpperCase() && welcomeCouponPct > 0) {
    await q(
      "INSERT IGNORE INTO coupons (code, type, value, min_subtotal_paise, max_discount_paise, active, description) VALUES (?, 'PERCENT', ?, 0, 20000, 1, 'First-order welcome coupon')",
      [welcomeCoupon.toUpperCase(), welcomeCouponPct],
    );
    c = await load();
  }
  if (!c || !c.active) return fail("That coupon code isn't valid.");
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return fail("That coupon has expired.");
  if (c.usage_limit !== null && c.used_count >= c.usage_limit) return fail("That coupon has reached its usage limit.");
  if (subtotalPaise < c.min_subtotal_paise) return fail(`Spend ₹${toRupees(c.min_subtotal_paise)} or more to use this coupon.`);

  if (welcomeCoupon && c.code === welcomeCoupon.toUpperCase()) {
    if (!customerId) return fail("Sign in to use this first-order coupon.");
    const [prior] = await q(
      "SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND status NOT IN ('CANCELLED','PAYMENT_FAILED','PENDING_PAYMENT')", // unpaid drafts don't count as a first order
      [customerId],
    );
    if (Number(prior.n) > 0) return fail("This coupon is for first orders only.");
  }

  let discount = c.type.toUpperCase() === "PERCENT" ? Math.floor((subtotalPaise * c.value) / 100) : c.value;
  if (c.max_discount_paise !== null) discount = Math.min(discount, c.max_discount_paise);
  discount = Math.min(discount, subtotalPaise);
  return { code: c.code, discountPaise: discount, error: null };
}

export async function resolveCart(
  items: CartItemInput[],
  opts: { couponCode?: string; customerId?: string | null; q?: Querier } = {},
): Promise<ResolvedCart> {
  const q = opts.q ?? query;
  const [lines, settings] = await Promise.all([resolveLines(items, q), getSettings()]);

  const subtotalPaise = lines.reduce((s, l) => s + l.unitPaise * l.quantity, 0);
  const coupon = await evaluateCoupon(opts.couponCode, subtotalPaise, opts.customerId ?? null, q);
  const afterDiscount = subtotalPaise - coupon.discountPaise;
  const thresholdPaise = Math.round(settings.freeShippingThreshold * 100);
  const shippingPaise = subtotalPaise === 0 || afterDiscount >= thresholdPaise ? 0 : Math.round(settings.shippingFee * 100);

  return {
    lines,
    subtotalPaise,
    discountPaise: coupon.discountPaise,
    shippingPaise,
    totalPaise: afterDiscount + shippingPaise,
    coupon,
    freeShippingThresholdPaise: thresholdPaise,
  };
}

/** Customer-facing view of a resolved cart (rupees). */
export function toPricedCart(r: ResolvedCart): PricedCart {
  const lines: PricedCartLine[] = r.lines.map((l) => ({
    variantId: l.variantId,
    productId: l.productId,
    slug: l.slug,
    name: l.name,
    variantLabel: l.variantLabel,
    imageUrl: l.imageUrl,
    unitPrice: toRupees(l.unitPaise),
    compareAtPrice: l.listPaise > l.unitPaise ? toRupees(l.listPaise) : null,
    quantity: l.quantity,
    requestedQuantity: l.requestedQuantity,
    available: l.available,
    lineTotal: toRupees(l.unitPaise * l.quantity),
    issue: l.issue,
  }));
  return {
    lines,
    totals: {
      subtotal: toRupees(r.subtotalPaise),
      discount: toRupees(r.discountPaise),
      shipping: toRupees(r.shippingPaise),
      total: toRupees(r.totalPaise),
      couponCode: r.coupon.code,
      couponError: r.coupon.error,
      freeShippingThreshold: toRupees(r.freeShippingThresholdPaise),
      amountToFreeShipping: Math.max(toRupees(r.freeShippingThresholdPaise - (r.subtotalPaise - r.discountPaise)), 0),
    },
  };
}

export class CartIssuesError extends ApiError {
  constructor(public cart: PricedCart) {
    super(409, "Some items in your cart changed. Please review your cart.", "cart_changed", undefined, { cart });
  }
}
