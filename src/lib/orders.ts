import type Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import type { CartLine } from "./cart";
import { priceOrder, type PriceBreakdown } from "./pricing";
import { getSettings, getShippingMethod, getZone } from "./settings";
import { canStaffTransition, isOrderStatus, type OrderStatus } from "./order-status";
import { enqueueOrderEvent } from "./notify/outbox";

type Db = Database.Database;

export type CheckoutDetails = {
  customerName: string;
  phone: string;
  email: string;
  zoneId: number;
  address: string;
  landmark: string;
  notes: string;
  shippingCode: string;
  notifySms?: boolean;
  notifyEmail?: boolean;
  notifyWhatsapp?: boolean;
  customerId?: number | null;
};

export type OrderRow = {
  id: number;
  number: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentRef: string;
  customerName: string;
  phone: string;
  email: string;
  zoneName: string;
  address: string;
  landmark: string;
  notes: string;
  shippingName: string;
  fxRate: number;
  fxMarkupPct: number;
  itemsGbpMinor: number;
  itemsGhsMinor: number;
  serviceFeeMinor: number;
  shippingMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  chargeableGrams: number;
  createdAt: string;
};

export type OrderItemRow = {
  id: number;
  shopName: string;
  name: string;
  options: Record<string, string>;
  quantity: number;
  unitPriceMinor: number;
  lineGhsMinor: number;
  sourceUrl: string;
};

export type OrderEvent = { status: string; note: string; createdAt: string };

type RawOrder = Record<string, unknown> & {
  id: number; number: string; status: string; payment_status: string; payment_ref: string; customer_name: string;
  phone: string; email: string; zone_name: string; address: string; landmark: string; notes: string;
  shipping_name: string; fx_rate: number; fx_markup_pct: number; items_gbp_minor: number; items_ghs_minor: number;
  service_fee_minor: number; shipping_minor: number; delivery_minor: number; total_minor: number;
  chargeable_grams: number; created_at: string;
};

function toOrder(r: RawOrder): OrderRow {
  return {
    id: r.id, number: r.number, status: (isOrderStatus(r.status) ? r.status : "PAID") as OrderStatus,
    paymentStatus: r.payment_status, paymentRef: r.payment_ref, customerName: r.customer_name, phone: r.phone,
    email: r.email, zoneName: r.zone_name, address: r.address, landmark: r.landmark, notes: r.notes,
    shippingName: r.shipping_name, fxRate: r.fx_rate, fxMarkupPct: r.fx_markup_pct,
    itemsGbpMinor: r.items_gbp_minor, itemsGhsMinor: r.items_ghs_minor, serviceFeeMinor: r.service_fee_minor,
    shippingMinor: r.shipping_minor, deliveryMinor: r.delivery_minor, totalMinor: r.total_minor,
    chargeableGrams: r.chargeable_grams, createdAt: r.created_at,
  };
}

export type QuoteError = { ok: false; error: string };

/**
 * Price a cart from live database values. Used by the cart page, checkout and
 * order creation, so what the customer sees is what they are charged.
 */
export function quoteCart(
  lines: CartLine[],
  zoneId: number | null,
  shippingCode: string | null,
  d: Db = db(),
): { ok: true; breakdown: PriceBreakdown; shippingName: string; zoneName: string } | QuoteError {
  const settings = getSettings(d);
  const method = shippingCode ? getShippingMethod(shippingCode, d) : null;
  const zone = zoneId ? getZone(zoneId, d) : null;
  if (!method) return { ok: false, error: "Choose a shipping method." };
  if (!zone) return { ok: false, error: "Choose your delivery area." };
  const breakdown = priceOrder({
    items: lines.map((l) => ({
      id: String(l.itemId),
      unitPriceMinor: l.product.priceMinor,
      quantity: l.quantity,
      weightGrams: l.product.weightGrams,
    })),
    fx: settings.fx,
    serviceFee: settings.serviceFee,
    rateCard: method.rateCard,
    deliveryFeeMinor: zone.feeMinor,
  });
  return { ok: true, breakdown, shippingName: method.name, zoneName: zone.name };
}

export function createOrder(
  lines: CartLine[],
  details: CheckoutDetails,
  d: Db = db(),
): { ok: true; paymentRef: string; number: string } | QuoteError {
  if (lines.length === 0) return { ok: false, error: "Your cart is empty." };
  const settings = getSettings(d);
  const quote = quoteCart(lines, details.zoneId, details.shippingCode, d);
  if (!quote.ok) return quote;
  const b = quote.breakdown;
  if (b.itemsGbpMinor < settings.minOrderGbpMinor) {
    return {
      ok: false,
      error: `The minimum order is £${(settings.minOrderGbpMinor / 100).toFixed(2)} of items.`,
    };
  }

  const paymentRef = `pay_${randomBytes(12).toString("hex")}`;
  const run = d.transaction(() => {
    const info = d
      .prepare(
        `INSERT INTO orders (number, status, payment_status, payment_ref, customer_name, phone, email, zone_id, zone_name,
           address, landmark, notes, shipping_code, shipping_name, fx_rate, fx_markup_pct, items_gbp_minor, items_ghs_minor,
           service_fee_minor, shipping_minor, delivery_minor, total_minor, chargeable_grams, notify_sms, notify_email, notify_whatsapp, customer_id)
         VALUES (@number, 'AWAITING_PAYMENT', 'PENDING', @ref, @name, @phone, @email, @zoneId, @zoneName,
           @address, @landmark, @notes, @shippingCode, @shippingName, @fx, @markup, @itemsGbp, @itemsGhs,
           @service, @shipping, @delivery, @total, @grams, @nSms, @nEmail, @nWhatsapp, @customerId)`,
      )
      .run({
        number: `TEMP-${paymentRef}`,
        ref: paymentRef,
        name: details.customerName,
        phone: details.phone,
        email: details.email,
        zoneId: details.zoneId,
        zoneName: quote.zoneName,
        address: details.address,
        landmark: details.landmark,
        notes: details.notes,
        shippingCode: details.shippingCode,
        shippingName: quote.shippingName,
        fx: settings.fx.rate,
        markup: settings.fx.markupPct,
        itemsGbp: b.itemsGbpMinor,
        itemsGhs: b.itemsGhsMinor,
        service: b.serviceFeeMinor,
        shipping: b.shippingMinor,
        delivery: b.deliveryMinor,
        total: b.totalMinor,
        grams: b.chargeableGrams,
        nSms: details.notifySms === false ? 0 : 1,
        nEmail: details.notifyEmail === false ? 0 : 1,
        nWhatsapp: details.notifyWhatsapp ? 1 : 0,
        customerId: details.customerId ?? null,
      });
    const id = Number(info.lastInsertRowid);
    const number = `UKG-${new Date().getFullYear()}-${String(id).padStart(6, "0")}`;
    d.prepare("UPDATE orders SET number = ? WHERE id = ?").run(number, id);

    const insertItem = d.prepare(
      `INSERT INTO order_items (order_id, product_id, shop_name, name, options, quantity, unit_price_minor, weight_grams, line_ghs_minor, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const l of lines) {
      const line = b.lines.find((x) => x.id === String(l.itemId));
      insertItem.run(
        id, l.product.id, l.product.shopName, l.product.name, JSON.stringify(l.options), l.quantity,
        l.product.priceMinor, l.product.weightGrams, line?.ghsMinor ?? 0, l.product.sourceUrl,
      );
    }
    d.prepare("INSERT INTO order_events (order_id, status, note) VALUES (?, 'AWAITING_PAYMENT', 'Order placed')").run(id);
    return number;
  });
  const number = run();
  return { ok: true, paymentRef, number };
}

export function getOrderByRef(ref: string, d: Db = db()): OrderRow | null {
  const r = d.prepare("SELECT * FROM orders WHERE payment_ref = ?").get(ref) as RawOrder | undefined;
  return r ? toOrder(r) : null;
}

export function getOrderById(id: number, d: Db = db()): OrderRow | null {
  const r = d.prepare("SELECT * FROM orders WHERE id = ?").get(id) as RawOrder | undefined;
  return r ? toOrder(r) : null;
}

export function getOrderByNumber(number: string, d: Db = db()): OrderRow | null {
  const r = d.prepare("SELECT * FROM orders WHERE number = ?").get(number) as RawOrder | undefined;
  return r ? toOrder(r) : null;
}

export function getOrderItems(orderId: number, d: Db = db()): OrderItemRow[] {
  const rows = d.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id").all(orderId) as {
    id: number; shop_name: string; name: string; options: string; quantity: number; unit_price_minor: number;
    line_ghs_minor: number; source_url: string;
  }[];
  return rows.map((r) => ({
    id: r.id, shopName: r.shop_name, name: r.name, quantity: r.quantity, unitPriceMinor: r.unit_price_minor,
    lineGhsMinor: r.line_ghs_minor, sourceUrl: r.source_url,
    options: (() => { try { return JSON.parse(r.options); } catch { return {}; } })(),
  }));
}

export function getOrderEvents(orderId: number, d: Db = db()): OrderEvent[] {
  const rows = d.prepare("SELECT status, note, created_at FROM order_events WHERE order_id = ? ORDER BY id").all(orderId) as {
    status: string; note: string; created_at: string;
  }[];
  return rows.map((r) => ({ status: r.status, note: r.note, createdAt: r.created_at }));
}

const digits = (s: string) => s.replace(/\D/g, "");

/** Compare phone numbers on their last nine digits so 024…, +233 24… and 233 24… all match. */
function samePhone(a: string, b: string): boolean {
  const x = digits(a);
  const y = digits(b);
  return x.length >= 9 && y.length >= 9 && x.slice(-9) === y.slice(-9);
}

/** An order is shown only when the number and the phone or email used at checkout both match. */
export function findOrderForTracking(number: string, contact: string, d: Db = db()): OrderRow | null {
  const order = getOrderByNumber(number.trim().toUpperCase(), d);
  if (!order) return null;
  const c = contact.trim();
  if (!c) return null;
  const emailMatch = order.email !== "" && order.email.toLowerCase() === c.toLowerCase();
  return samePhone(order.phone, c) || emailMatch ? order : null;
}

export function listOrders(opts: { status?: string; q?: string } = {}, d: Db = db()): OrderRow[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.status && isOrderStatus(opts.status)) {
    where.push("status = ?");
    args.push(opts.status);
  }
  if (opts.q?.trim()) {
    where.push("(number LIKE ? OR LOWER(customer_name) LIKE ? OR phone LIKE ?)");
    const like = `%${opts.q.trim().toLowerCase()}%`;
    args.push(like.toUpperCase(), like, like);
  }
  const rows = d
    .prepare(`SELECT * FROM orders ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT 300`)
    .all(...args) as RawOrder[];
  return rows.map(toOrder);
}

export function orderCounts(d: Db = db()): Record<string, number> {
  const rows = d.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status").all() as { status: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

/**
 * Confirm a payment. Safe to call more than once: only the first call changes anything.
 * The order moves to PAID only if it was still awaiting payment; a payment that lands on a
 * cancelled order is recorded and flagged so staff can refund it.
 */
export function markPaid(ref: string, d: Db = db(), note = "Payment confirmed"): boolean {
  const run = d.transaction(() => {
    const o = d.prepare("SELECT id, status, payment_status FROM orders WHERE payment_ref = ?").get(ref) as
      | { id: number; status: string; payment_status: string }
      | undefined;
    if (!o || o.payment_status === "PAID" || o.payment_status === "REFUNDED") return false;
    d.prepare(
      "UPDATE orders SET payment_status = 'PAID', status = CASE WHEN status = 'AWAITING_PAYMENT' THEN 'PAID' ELSE status END WHERE id = ?",
    ).run(o.id);
    if (o.status === "AWAITING_PAYMENT") {
      d.prepare("INSERT INTO order_events (order_id, status, note) VALUES (?, 'PAID', ?)").run(o.id, note);
    } else {
      d.prepare("INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)").run(
        o.id, o.status, `${note}, but the order was already ${o.status}. Check whether a refund is needed.`,
      );
    }
    return true;
  });
  const changed = run();
  if (changed) queueMessages(ref, d);
  return changed;
}

/** Queue customer messages for an order's new status. A messaging problem must never break an order. */
function queueMessages(ref: string, d: Db): void {
  try {
    const o = d.prepare("SELECT id, status FROM orders WHERE payment_ref = ?").get(ref) as { id: number; status: string } | undefined;
    if (o && isOrderStatus(o.status) && o.status === "PAID") enqueueOrderEvent(o.id, "PAID", d);
  } catch (e) {
    console.error("[orders] could not queue messages", e instanceof Error ? e.message : "unknown error");
  }
}

export function markPaymentFailed(ref: string, d: Db = db()): boolean {
  const info = d
    .prepare("UPDATE orders SET payment_status = 'FAILED' WHERE payment_ref = ? AND payment_status = 'PENDING'")
    .run(ref);
  return info.changes > 0;
}

export function staffSetStatus(
  orderId: number,
  to: string,
  note: string,
  d: Db = db(),
): { ok: true } | { ok: false; error: string } {
  const r = d.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as RawOrder | undefined;
  if (!r) return { ok: false, error: "Order not found." };
  const order = toOrder(r);
  if (!isOrderStatus(to) || !canStaffTransition(order.status, to, order.paymentStatus)) {
    return { ok: false, error: "That status change is not allowed from the current status." };
  }
  d.transaction(() => {
    d.prepare("UPDATE orders SET status = ? WHERE id = ?").run(to, orderId);
    d.prepare("INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)").run(orderId, to, note.slice(0, 500));
    if (to === "REFUNDED") d.prepare("UPDATE orders SET payment_status = 'REFUNDED' WHERE id = ?").run(orderId);
  })();
  try {
    enqueueOrderEvent(orderId, to, d);
  } catch (e) {
    console.error("[orders] could not queue messages", e instanceof Error ? e.message : "unknown error");
  }
  return { ok: true };
}

export type CustomerOrderSummary = OrderRow & { itemCount: number; firstItem: string };

/** A customer's own orders, newest first. */
export function listOrdersForCustomer(customerId: number, d: Db = db()): CustomerOrderSummary[] {
  const rows = d
    .prepare(
      `SELECT o.*,
         (SELECT COALESCE(SUM(quantity), 0) FROM order_items i WHERE i.order_id = o.id) AS item_count,
         (SELECT name FROM order_items i WHERE i.order_id = o.id ORDER BY id LIMIT 1) AS first_item
       FROM orders o WHERE o.customer_id = ? ORDER BY o.id DESC LIMIT 200`,
    )
    .all(customerId) as (RawOrder & { item_count: number; first_item: string | null })[];
  return rows.map((r) => ({ ...toOrder(r), itemCount: r.item_count, firstItem: r.first_item ?? "" }));
}

/** Items from a customer's own order that can be bought again (still on sale). */
export function reorderableItems(
  customerId: number,
  orderNumber: string,
  d: Db = db(),
): { productId: number; quantity: number; options: Record<string, string> }[] {
  const order = d.prepare("SELECT id FROM orders WHERE number = ? AND customer_id = ?").get(orderNumber, customerId) as { id: number } | undefined;
  if (!order) return [];
  const rows = d.prepare("SELECT product_id, quantity, options FROM order_items WHERE order_id = ? AND product_id IS NOT NULL").all(order.id) as {
    product_id: number; quantity: number; options: string;
  }[];
  return rows.map((r) => ({
    productId: r.product_id,
    quantity: r.quantity,
    options: (() => {
      try {
        return JSON.parse(r.options) as Record<string, string>;
      } catch {
        return {};
      }
    })(),
  }));
}

// ------------------------------------------------------------------ tracking

export const TRACKING_STAGES = ["RETAILER", "UK_ADDRESS", "INTERNATIONAL", "COURIER"] as const;
export type TrackingStage = (typeof TRACKING_STAGES)[number];

export const TRACKING_STAGE_LABEL: Record<TrackingStage, string> = {
  RETAILER: "UK shop dispatch",
  UK_ADDRESS: "Received at our UK address",
  INTERNATIONAL: "UK to Ghana shipment",
  COURIER: "Delivery in Ghana",
};

export type TrackingEntry = { id: number; stage: TrackingStage; carrier: string; reference: string; url: string; note: string; createdAt: string };

export function addTracking(
  orderId: number,
  t: { stage: string; carrier: string; reference: string; url: string; note: string },
  d: Db = db(),
): { ok: true } | { ok: false; error: string } {
  if (!(TRACKING_STAGES as readonly string[]).includes(t.stage)) return { ok: false, error: "Choose a tracking stage." };
  const reference = t.reference.trim().slice(0, 80);
  const carrier = t.carrier.trim().slice(0, 60);
  if (!reference && !t.note.trim()) return { ok: false, error: "Enter a tracking number or a note." };
  let url = t.url.trim();
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
      url = u.toString();
    } catch {
      return { ok: false, error: "The tracking link must start with https://" };
    }
  }
  if (!d.prepare("SELECT 1 FROM orders WHERE id = ?").get(orderId)) return { ok: false, error: "Order not found." };
  d.transaction(() => {
    d.prepare("INSERT INTO order_tracking (order_id, stage, carrier, reference, url, note) VALUES (?, ?, ?, ?, ?, ?)").run(
      orderId, t.stage, carrier, reference, url, t.note.trim().slice(0, 300),
    );
    const o = d.prepare("SELECT status FROM orders WHERE id = ?").get(orderId) as { status: string };
    const label = TRACKING_STAGE_LABEL[t.stage as TrackingStage];
    d.prepare("INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)").run(
      orderId, o.status, `${label}${carrier ? ` (${carrier})` : ""}${reference ? `: ${reference}` : ""}`,
    );
  })();
  return { ok: true };
}

export function getTracking(orderId: number, d: Db = db()): TrackingEntry[] {
  const rows = d.prepare("SELECT * FROM order_tracking WHERE order_id = ? ORDER BY id").all(orderId) as {
    id: number; stage: string; carrier: string; reference: string; url: string; note: string; created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id, stage: r.stage as TrackingStage, carrier: r.carrier, reference: r.reference, url: r.url, note: r.note, createdAt: r.created_at,
  }));
}

export function deleteTracking(orderId: number, trackingId: number, d: Db = db()): void {
  d.prepare("DELETE FROM order_tracking WHERE id = ? AND order_id = ?").run(trackingId, orderId);
}

/** Look up one of a customer's own orders by its number. */
export function getOrderForCustomer(customerId: number, number: string, d: Db = db()): OrderRow | null {
  const r = d.prepare("SELECT * FROM orders WHERE number = ? AND customer_id = ?").get(number, customerId) as RawOrder | undefined;
  return r ? toOrder(r) : null;
}
