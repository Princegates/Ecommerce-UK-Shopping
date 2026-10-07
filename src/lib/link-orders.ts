import { randomBytes } from "node:crypto";
import type Database from "better-sqlite3";
import { db } from "./db";
import type { CartLine } from "./cart";
import type { Product } from "./catalog";
import { createOrder, getOrderById, type CheckoutDetails } from "./orders";

type Db = Database.Database;

/**
 * Link orders: a customer sends a link, the team checks the item and quotes the UK price, and the customer pays through the
 * normal checkout. The paid order then moves through the same stages as any other order, so nothing lives outside the system.
 */

export const MIN_QUOTE_MINOR = 50; // 50p
export const MAX_QUOTE_MINOR = 1_000_000; // £10,000

export type LinkRequestRow = {
  id: number; token: string | null; url: string; title: string; details: string; quantity: number; priceSeen: string;
  name: string; phone: string; email: string; status: string; adminNote: string; createdAt: string; customerId: number | null;
  quotePriceMinor: number | null; quoteWeightGrams: number | null; quoteNote: string; quotedAt: string | null; quoteExpiresAt: string | null; orderId: number | null;
};

type Raw = {
  id: number; token: string | null; url: string; title: string; details: string; quantity: number; price_seen: string; name: string; phone: string;
  email: string; status: string; admin_note: string; created_at: string; customer_id: number | null; quote_price_minor: number | null;
  quote_weight_grams: number | null; quote_note: string; quoted_at: string | null; quote_expires_at: string | null; order_id: number | null;
};

const toRow = (r: Raw): LinkRequestRow => ({
  id: r.id, token: r.token, url: r.url, title: r.title, details: r.details, quantity: r.quantity, priceSeen: r.price_seen, name: r.name, phone: r.phone,
  email: r.email, status: r.status, adminNote: r.admin_note, createdAt: r.created_at, customerId: r.customer_id, quotePriceMinor: r.quote_price_minor,
  quoteWeightGrams: r.quote_weight_grams, quoteNote: r.quote_note, quotedAt: r.quoted_at, quoteExpiresAt: r.quote_expires_at, orderId: r.order_id,
});

const sqlTime = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);

export function getLinkRequest(id: number, d: Db = db()): LinkRequestRow | null {
  const r = d.prepare("SELECT * FROM link_requests WHERE id = ?").get(id) as Raw | undefined;
  return r ? toRow(r) : null;
}

export function listAllLinkRequests(d: Db = db()): LinkRequestRow[] {
  return (d.prepare("SELECT * FROM link_requests ORDER BY (status = 'NEW') DESC, id DESC LIMIT 300").all() as Raw[]).map(toRow);
}

export function getLinkRequestByToken(token: string, d: Db = db()): LinkRequestRow | null {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const r = d.prepare("SELECT * FROM link_requests WHERE token = ?").get(token) as Raw | undefined;
  return r ? toRow(r) : null;
}

/** Requests the customer sent while signed in, or that were made with their phone number. */
export function listRequestsForCustomer(customerId: number, phone: string, d: Db = db()): LinkRequestRow[] {
  const digits = phone.replace(/\D/g, "").slice(-9);
  const rows = d.prepare("SELECT * FROM link_requests WHERE customer_id = ? OR (customer_id IS NULL AND ? <> '' AND REPLACE(REPLACE(phone, ' ', ''), '+', '') LIKE ?) ORDER BY id DESC LIMIT 30")
    .all(customerId, digits, `%${digits}`) as Raw[];
  return rows.map(toRow);
}

export type QuoteState = "waiting" | "open" | "expired" | "ordered" | "rejected";

export function quoteState(r: LinkRequestRow, now = Date.now()): QuoteState {
  if (r.orderId || r.status === "ORDERED") return "ordered";
  if (r.status === "REJECTED") return "rejected";
  if (r.quotePriceMinor === null || !r.token) return "waiting";
  if (r.quoteExpiresAt && Date.parse(`${r.quoteExpiresAt.replace(" ", "T")}Z`) < now) return "expired";
  return "open";
}

export type QuoteInput = { unitPriceMinor: number; weightGrams: number; validDays: number; note: string };

/** Records the UK price the team has checked and opens the customer's pay link. Can be repeated until the customer orders. */
export function quoteRequest(id: number, q: QuoteInput, d: Db = db(), now = Date.now()): { ok: true; token: string } | { ok: false; error: string } {
  const r = getLinkRequest(id, d);
  if (!r) return { ok: false, error: "That request no longer exists." };
  if (r.orderId || r.status === "ORDERED") return { ok: false, error: "The customer has already ordered this item." };
  if (!Number.isInteger(q.unitPriceMinor) || q.unitPriceMinor < MIN_QUOTE_MINOR || q.unitPriceMinor > MAX_QUOTE_MINOR) {
    return { ok: false, error: "Enter the UK price of one item, between £0.50 and £10,000." };
  }
  if (!Number.isInteger(q.weightGrams) || q.weightGrams < 1 || q.weightGrams > 50_000) return { ok: false, error: "Enter the weight of one item in grams (1 to 50,000)." };
  const days = Math.min(30, Math.max(1, Math.round(q.validDays || 3)));
  const token = r.token ?? randomBytes(24).toString("base64url");
  d.prepare(
    `UPDATE link_requests SET token = ?, quote_price_minor = ?, quote_weight_grams = ?, quote_note = ?, quoted_at = ?, quote_expires_at = ?,
       status = 'QUOTED' WHERE id = ?`,
  ).run(token, q.unitPriceMinor, q.weightGrams, q.note.trim().slice(0, 300), sqlTime(now), sqlTime(now + days * 86_400_000), id);
  return { ok: true, token };
}

/** The shop the item comes from, taken from its web address. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "UK shop";
  }
}

/** The quoted item as a cart line, so checkout and pricing treat it like any other item. It is not a product on the shop. */
export function quotedLine(r: LinkRequestRow): CartLine {
  const host = hostOf(r.url);
  const product: Product = {
    id: 0, slug: "", name: r.title || `Item from ${host}`, brand: "", category: "", description: "",
    priceMinor: r.quotePriceMinor ?? 0, weightGrams: r.quoteWeightGrams ?? 500, options: [], imageUrl: null, sourceUrl: r.url, active: true,
    shopId: 0, shopSlug: "", shopName: host, shopAccent: "#0b5d3b", shopLogoUrl: "", shopCategory: "", compareAtMinor: null, dealEndsAt: null,
    reviewCount: 0, ratingAvg: null, createdAt: r.createdAt,
  };
  return { itemId: -r.id, product, quantity: r.quantity, options: {} };
}

/** Turns an open quote into an order awaiting payment. A second click returns the order that already exists. */
export function placeLinkOrder(
  token: string, details: CheckoutDetails, d: Db = db(), now = Date.now(),
): { ok: true; paymentRef: string; number: string; existing: boolean } | { ok: false; error: string } {
  const r = getLinkRequestByToken(token, d);
  if (!r) return { ok: false, error: "That quote link is not valid." };
  if (r.orderId) {
    const o = getOrderById(r.orderId, d);
    if (o) return { ok: true, paymentRef: o.paymentRef, number: o.number, existing: true };
  }
  const state = quoteState(r, now);
  if (state === "expired") return { ok: false, error: "This quote has expired because UK prices change. Please contact us for a fresh one." };
  if (state !== "open") return { ok: false, error: "This request cannot be ordered." };
  const res = createOrder([quotedLine(r)], { ...details, customerId: details.customerId ?? r.customerId }, d);
  if (!res.ok) return res;
  const order = d.prepare("SELECT id FROM orders WHERE payment_ref = ?").get(res.paymentRef) as { id: number };
  d.prepare("UPDATE link_requests SET status = 'ORDERED', order_id = ?, customer_id = COALESCE(customer_id, ?) WHERE id = ?").run(order.id, details.customerId ?? null, r.id);
  d.prepare("UPDATE order_items SET product_id = NULL WHERE order_id = ?").run(order.id);
  d.prepare("INSERT INTO order_events (order_id, status, note) VALUES (?, 'AWAITING_PAYMENT', ?)").run(order.id, `From link request #${r.id}`);
  return { ok: true, paymentRef: res.paymentRef, number: res.number, existing: false };
}
