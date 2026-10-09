import type Database from "better-sqlite3";
import { db } from "./db";
import { autoQuoteRequest, getItemTypes, getLinkAuto } from "./link-auto";

type Db = Database.Database;

export type LinkRequestInput = {
  url: string; title: string; details: string; quantity: number; priceSeen: string; itemType: string; name: string; phone: string; email: string;
};

/**
 * Saves a link request and prices it by itself when the admin's rules allow. `readPagePrice` returns the price (in pence) the
 * system read from the shop's own page, or null when it could not. A failure there only means a person quotes it.
 */
export async function submitLinkRequest(
  i: LinkRequestInput,
  customerId: number | null,
  readPagePrice: (url: string) => Promise<number | null>,
  d: Db = db(),
  now = Date.now(),
): Promise<{ id: number; quote?: { token: string; unitPriceMinor: number; source: "page" | "customer" } }> {
  const itemType = getItemTypes(d).some((t) => t.name === i.itemType) ? i.itemType : "";
  const info = d
    .prepare("INSERT INTO link_requests (url, title, details, quantity, price_seen, name, phone, email, customer_id, item_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(i.url, i.title, i.details, i.quantity, i.priceSeen, i.name, i.phone, i.email, customerId, itemType);
  const id = Number(info.lastInsertRowid);
  if (!i.url) return { id }; // described, not linked: a person finds the item and quotes it
  try {
    const page = getLinkAuto(d).pageEnabled ? await readPagePrice(i.url) : null;
    if (page !== null && !i.priceSeen) d.prepare("UPDATE link_requests SET price_seen = ? WHERE id = ?").run((page / 100).toFixed(2), id);
    const q = autoQuoteRequest(id, page, d, now);
    if (q.quoted) return { id, quote: { token: q.token, unitPriceMinor: q.unitPriceMinor, source: q.source } };
  } catch (e) {
    console.error("[request] automatic quote failed", e instanceof Error ? e.message : "unknown error");
  }
  return { id };
}
