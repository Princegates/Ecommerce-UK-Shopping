import type Database from "better-sqlite3";
import { db } from "./db";

type Db = Database.Database;

export type OrderCosts = {
  retailerGbpMinor: number;
  ukDeliveryGbpMinor: number;
  /** GHS per £1 on the day we paid the shop. Zero means "use the rate the customer was quoted". */
  purchaseRate: number;
  freightGhsMinor: number;
  localDeliveryGhsMinor: number;
  paymentFeesGhsMinor: number;
  otherGhsMinor: number;
  note: string;
};

export const EMPTY_COSTS: OrderCosts = {
  retailerGbpMinor: 0, ukDeliveryGbpMinor: 0, purchaseRate: 0, freightGhsMinor: 0, localDeliveryGhsMinor: 0,
  paymentFeesGhsMinor: 0, otherGhsMinor: 0, note: "",
};

export type Margin = { revenueMinor: number; costMinor: number; marginMinor: number; marginPct: number | null; rateUsed: number };

/** What the order really cost us in cedis, and what is left of what the customer paid. */
export function orderMargin(revenueMinor: number, quotedRate: number, c: OrderCosts): Margin {
  const rateUsed = c.purchaseRate > 0 ? c.purchaseRate : quotedRate;
  const gbpCost = Math.round((c.retailerGbpMinor + c.ukDeliveryGbpMinor) * rateUsed);
  const costMinor = gbpCost + c.freightGhsMinor + c.localDeliveryGhsMinor + c.paymentFeesGhsMinor + c.otherGhsMinor;
  const marginMinor = revenueMinor - costMinor;
  return { revenueMinor, costMinor, marginMinor, marginPct: revenueMinor > 0 ? marginMinor / revenueMinor : null, rateUsed };
}

export function getCosts(orderId: number, d: Db = db()): OrderCosts | null {
  const r = d.prepare("SELECT * FROM order_costs WHERE order_id = ?").get(orderId) as
    | { retailer_gbp_minor: number; uk_delivery_gbp_minor: number; purchase_rate: number; freight_ghs_minor: number; local_delivery_ghs_minor: number; payment_fees_ghs_minor: number; other_ghs_minor: number; note: string }
    | undefined;
  return r
    ? {
        retailerGbpMinor: r.retailer_gbp_minor, ukDeliveryGbpMinor: r.uk_delivery_gbp_minor, purchaseRate: r.purchase_rate,
        freightGhsMinor: r.freight_ghs_minor, localDeliveryGhsMinor: r.local_delivery_ghs_minor, paymentFeesGhsMinor: r.payment_fees_ghs_minor,
        otherGhsMinor: r.other_ghs_minor, note: r.note,
      }
    : null;
}

export function saveCosts(orderId: number, c: OrderCosts, d: Db = db()): void {
  d.prepare(
    `INSERT INTO order_costs (order_id, retailer_gbp_minor, uk_delivery_gbp_minor, purchase_rate, freight_ghs_minor, local_delivery_ghs_minor, payment_fees_ghs_minor, other_ghs_minor, note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(order_id) DO UPDATE SET retailer_gbp_minor = excluded.retailer_gbp_minor, uk_delivery_gbp_minor = excluded.uk_delivery_gbp_minor,
       purchase_rate = excluded.purchase_rate, freight_ghs_minor = excluded.freight_ghs_minor, local_delivery_ghs_minor = excluded.local_delivery_ghs_minor,
       payment_fees_ghs_minor = excluded.payment_fees_ghs_minor, other_ghs_minor = excluded.other_ghs_minor, note = excluded.note, updated_at = excluded.updated_at`,
  ).run(
    orderId, c.retailerGbpMinor, c.ukDeliveryGbpMinor, c.purchaseRate, c.freightGhsMinor, c.localDeliveryGhsMinor,
    c.paymentFeesGhsMinor, c.otherGhsMinor, c.note.slice(0, 300),
  );
}
