import "server-only";

/**
 * An online order only counts as placed once payment is confirmed. Until then it is an unpaid draft that holds
 * stock for a short time, so lists, counts and the dashboard leave it out. Requires the orders table aliased as `o`.
 */
export const PLACED_ORDER_SQL = `(o.status NOT IN ('PENDING_PAYMENT','PAYMENT_FAILED'))`;

/**
 * What counts as revenue: money actually captured on orders that were not
 * cancelled, returned or refunded. Requires the orders table aliased `o`.
 */
export const REVENUE_ORDER_SQL = `(o.payment_status = 'CAPTURED' AND o.status NOT IN ('CANCELLED','RETURNED','REFUNDED'))`;
