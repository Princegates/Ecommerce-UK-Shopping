import type Database from "better-sqlite3";
import { db } from "./db";
import { drift, getFxPolicy } from "./fx-api";
import { orderMargin, type OrderCosts } from "./margin";
import { ORDER_STATUSES } from "./order-status";

type Db = Database.Database;

export type RangeDays = 7 | 30 | 90;
export const RANGES: RangeDays[] = [7, 30, 90];
export const parseRange = (v: string | undefined): RangeDays => (RANGES.find((r) => String(r) === v) ?? 30) as RangeDays;


type Totals = { orders: number; revenue: number; items: number; service: number; shipping: number; delivery: number };

function totals(from: string, to: string, d: Db): Totals {
  const r = d
    .prepare(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(total_minor), 0) AS revenue, COALESCE(SUM(items_ghs_minor), 0) AS items,
              COALESCE(SUM(service_fee_minor), 0) AS service, COALESCE(SUM(shipping_minor), 0) AS shipping, COALESCE(SUM(delivery_minor), 0) AS delivery
       FROM orders o WHERE o.payment_status = 'PAID' AND o.created_at >= datetime('now', ?) AND o.created_at < datetime('now', ?)`,
    )
    .get(from, to) as Totals;
  return r;
}

export type Kpis = {
  orders: number;
  revenueMinor: number;
  averageOrderMinor: number;
  serviceFeeMinor: number;
  itemsMinor: number;
  shippingMinor: number;
  deliveryMinor: number;
  newCustomers: number;
  previous: { orders: number; revenueMinor: number; averageOrderMinor: number; newCustomers: number };
};

export function kpis(range: RangeDays, d: Db = db()): Kpis {
  const now = totals(`-${range} days`, "+1 day", d);
  const before = totals(`-${range * 2} days`, `-${range} days`, d);
  const nc = (from: string, to: string) =>
    (d.prepare("SELECT COUNT(*) AS n FROM customers WHERE created_at >= datetime('now', ?) AND created_at < datetime('now', ?)").get(from, to) as { n: number }).n;
  const aov = (t: Totals) => (t.orders ? Math.round(t.revenue / t.orders) : 0);
  return {
    orders: now.orders, revenueMinor: now.revenue, averageOrderMinor: aov(now), serviceFeeMinor: now.service, itemsMinor: now.items,
    shippingMinor: now.shipping, deliveryMinor: now.delivery, newCustomers: nc(`-${range} days`, "+1 day"),
    previous: { orders: before.orders, revenueMinor: before.revenue, averageOrderMinor: aov(before), newCustomers: nc(`-${range * 2} days`, `-${range} days`) },
  };
}

/** Percentage change, or null when there was nothing to compare with. */
export function change(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null;
  return (now - before) / before;
}

export type DayPoint = { day: string; orders: number; revenueMinor: number };

export function salesByDay(range: RangeDays, d: Db = db(), today = new Date()): DayPoint[] {
  const rows = d
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS orders, SUM(total_minor) AS revenue FROM orders o
       WHERE o.payment_status = 'PAID' AND o.created_at >= datetime('now', ?) GROUP BY date(created_at)`,
    )
    .all(`-${range} days`) as { day: string; orders: number; revenue: number }[];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: DayPoint[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i)).toISOString().slice(0, 10);
    const r = byDay.get(day);
    out.push({ day, orders: r?.orders ?? 0, revenueMinor: r?.revenue ?? 0 });
  }
  return out;
}

export function pipeline(d: Db = db()): { status: string; count: number }[] {
  const rows = d.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status").all() as { status: string; n: number }[];
  const map = new Map(rows.map((r) => [r.status, r.n]));
  return ORDER_STATUSES.filter((s) => s !== "CANCELLED" && s !== "REFUNDED").map((s) => ({ status: s, count: map.get(s) ?? 0 }));
}

export type RankRow = { name: string; orders: number; units: number; revenueMinor: number };

export function topShops(range: RangeDays, limit = 6, d: Db = db()): RankRow[] {
  const rows = d
    .prepare(
      `SELECT i.shop_name AS name, COUNT(DISTINCT o.id) AS orders, SUM(i.quantity) AS units, SUM(i.line_ghs_minor) AS revenue
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.payment_status = 'PAID' AND o.created_at >= datetime('now', ?)
       GROUP BY i.shop_name ORDER BY revenue DESC LIMIT ?`,
    )
    .all(`-${range} days`, limit) as { name: string; orders: number; units: number; revenue: number }[];
  return rows.map((r) => ({ name: r.name, orders: r.orders, units: r.units, revenueMinor: r.revenue }));
}

export function topItems(range: RangeDays, limit = 8, d: Db = db()): RankRow[] {
  const rows = d
    .prepare(
      `SELECT i.name AS name, COUNT(DISTINCT o.id) AS orders, SUM(i.quantity) AS units, SUM(i.line_ghs_minor) AS revenue
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.payment_status = 'PAID' AND o.created_at >= datetime('now', ?)
       GROUP BY i.product_id, i.name ORDER BY units DESC, revenue DESC LIMIT ?`,
    )
    .all(`-${range} days`, limit) as { name: string; orders: number; units: number; revenue: number }[];
  return rows.map((r) => ({ name: r.name, orders: r.orders, units: r.units, revenueMinor: r.revenue }));
}

export function topAreas(range: RangeDays, d: Db = db()): { name: string; orders: number; revenueMinor: number }[] {
  const rows = d
    .prepare(
      `SELECT zone_name AS name, COUNT(*) AS orders, SUM(total_minor) AS revenue FROM orders o
       WHERE o.payment_status = 'PAID' AND o.created_at >= datetime('now', ?) GROUP BY zone_name ORDER BY orders DESC`,
    )
    .all(`-${range} days`) as { name: string; orders: number; revenue: number }[];
  return rows.map((r) => ({ name: r.name, orders: r.orders, revenueMinor: r.revenue }));
}

/** Best sellers for the storefront: units sold over the last 30 days. */
export function bestSellerIds(limit = 8, d: Db = db()): number[] {
  const rows = d
    .prepare(
      `SELECT i.product_id AS id FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.payment_status = 'PAID' AND i.product_id IS NOT NULL AND o.created_at >= datetime('now', '-30 days')
       GROUP BY i.product_id ORDER BY SUM(i.quantity) DESC, MAX(o.id) DESC LIMIT ?`,
    )
    .all(limit) as { id: number }[];
  return rows.map((r) => r.id);
}

export type CustomerStats = { accounts: number; withOrders: number; repeat: number; disabled: number; newInRange: number };

export function customerStats(range: RangeDays, d: Db = db()): CustomerStats {
  const one = (sql: string, ...a: unknown[]) => (d.prepare(sql).get(...a) as { n: number }).n;
  return {
    accounts: one("SELECT COUNT(*) AS n FROM customers"),
    withOrders: one("SELECT COUNT(DISTINCT customer_id) AS n FROM orders WHERE customer_id IS NOT NULL AND payment_status = 'PAID'"),
    repeat: one("SELECT COUNT(*) AS n FROM (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL AND payment_status = 'PAID' GROUP BY customer_id HAVING COUNT(*) > 1)"),
    disabled: one("SELECT COUNT(*) AS n FROM customers WHERE status <> 'ACTIVE'"),
    newInRange: one("SELECT COUNT(*) AS n FROM customers WHERE created_at >= datetime('now', ?)", `-${range} days`),
  };
}

export type Margins = { ordersCosted: number; revenueMinor: number; costMinor: number; marginMinor: number; marginPct: number | null; ordersMissingCosts: number };

/** Margin over orders in the range that have costs recorded. Orders without costs are counted, not guessed. */
export function margins(range: RangeDays, d: Db = db()): Margins {
  const rows = d
    .prepare(
      `SELECT o.total_minor, o.fx_rate, c.* FROM orders o LEFT JOIN order_costs c ON c.order_id = o.id
       WHERE o.payment_status = 'PAID' AND o.status NOT IN ('CANCELLED', 'REFUNDED') AND o.created_at >= datetime('now', ?)`,
    )
    .all(`-${range} days`) as Record<string, number | string | null>[];
  let ordersCosted = 0, revenue = 0, cost = 0, missing = 0;
  for (const r of rows) {
    if (r.order_id === null) {
      missing++;
      continue;
    }
    const costs: OrderCosts = {
      retailerGbpMinor: Number(r.retailer_gbp_minor), ukDeliveryGbpMinor: Number(r.uk_delivery_gbp_minor), purchaseRate: Number(r.purchase_rate),
      freightGhsMinor: Number(r.freight_ghs_minor), localDeliveryGhsMinor: Number(r.local_delivery_ghs_minor), paymentFeesGhsMinor: Number(r.payment_fees_ghs_minor),
      otherGhsMinor: Number(r.other_ghs_minor), note: "",
    };
    const m = orderMargin(Number(r.total_minor), Number(r.fx_rate), costs);
    ordersCosted++;
    revenue += m.revenueMinor;
    cost += m.costMinor;
  }
  return { ordersCosted, revenueMinor: revenue, costMinor: cost, marginMinor: revenue - cost, marginPct: revenue > 0 ? (revenue - cost) / revenue : null, ordersMissingCosts: missing };
}

export type QueueItem = { key: string; label: string; count: number; href: string; tone: "urgent" | "normal"; hint: string };

/** What needs a person's attention now, most urgent first. Items with a count of zero are left out. */
export function actionQueue(agingDays = 5, d: Db = db()): QueueItem[] {
  const one = (sql: string, ...a: unknown[]) => (d.prepare(sql).get(...a) as { n: number }).n;
  const items: QueueItem[] = [
    {
      key: "refund", label: "Paid orders that need a refund", tone: "urgent", href: "/admin/orders?status=CANCELLED", hint: "Cancelled after payment. Refund them, then mark as refunded.",
      count: one("SELECT COUNT(*) AS n FROM orders WHERE status = 'CANCELLED' AND payment_status = 'PAID'"),
    },
    {
      key: "mismatch", label: "Payments with the wrong amount", tone: "urgent", href: "/admin/integrations#payments", hint: "A gateway reported a different amount than we asked for. Check before shipping.",
      count: one("SELECT COUNT(*) AS n FROM payments WHERE status = 'MISMATCH'"),
    },
    {
      key: "tobuy", label: "Paid orders waiting to be bought", tone: "urgent", href: "/admin/orders?status=PAID", hint: "Place these with the UK shops.",
      count: one("SELECT COUNT(*) AS n FROM orders WHERE status = 'PAID'"),
    },
    {
      key: "requests", label: "New link requests", tone: "normal", href: "/admin/requests", hint: "Check the price and stock, then quote the customer.",
      count: one("SELECT COUNT(*) AS n FROM link_requests WHERE status = 'NEW'"),
    },
    {
      key: "aging", label: `Orders with no movement for ${agingDays}+ days`, tone: "normal", href: "/admin/orders", hint: "Open orders whose last update is old. Chase the shop, forwarder or courier.",
      count: one(
        `SELECT COUNT(*) AS n FROM orders o WHERE o.status IN ('PURCHASING', 'PURCHASED', 'AT_UK_WAREHOUSE', 'SHIPPED_TO_GHANA', 'IN_CUSTOMS', 'OUT_FOR_DELIVERY')
         AND (SELECT MAX(created_at) FROM order_events e WHERE e.order_id = o.id) < datetime('now', ?)`,
        `-${agingDays} days`,
      ),
    },
    {
      key: "importreview", label: "Imported items waiting for review", tone: "normal", href: "/admin/import", hint: "Odd prices, big price jumps or items you chose to approve by hand.",
      count: one("SELECT COUNT(*) AS n FROM import_items WHERE status IN ('PENDING', 'HELD')"),
    },
    {
      key: "sourceproblem", label: "Catalogue sources that stopped", tone: "urgent", href: "/admin/sources", hint: "A shop refused access or a feed failed. Open the source to see why.",
      count: one("SELECT COUNT(*) AS n FROM catalog_sources WHERE enabled = 1 AND last_status IN ('BLOCKED', 'ERROR')"),
    },
    {
      key: "failedmsg", label: "Messages that could not be sent", tone: "normal", href: "/admin/messages?status=FAILED", hint: "Check the provider keys, then retry.",
      count: one("SELECT COUNT(*) AS n FROM messages WHERE status = 'FAILED'"),
    },
    {
      key: "unpaid", label: "Unpaid orders older than 24 hours", tone: "normal", href: "/admin/orders?status=AWAITING_PAYMENT", hint: "Customers who stopped at payment. A nudge may help.",
      count: one("SELECT COUNT(*) AS n FROM orders WHERE status = 'AWAITING_PAYMENT' AND created_at < datetime('now', '-1 day')"),
    },
  ];
  const gap = drift(d);
  const alert = getFxPolicy(d).alertPct / 100;
  if (gap !== null && Math.abs(gap) >= alert) {
    items.unshift({
      key: "fxdrift",
      label: `Your exchange rate is ${(Math.abs(gap) * 100).toFixed(1)}% ${gap > 0 ? "above" : "below"} the market`,
      tone: gap < 0 ? "urgent" : "normal",
      href: "/admin#rate",
      hint: gap < 0 ? "You are selling pounds for fewer cedis than the market gives. Update it." : "Customers are paying more than the market rate. Check it is intended.",
      count: 1,
    });
  }
  return items.filter((i) => i.count > 0);
}
