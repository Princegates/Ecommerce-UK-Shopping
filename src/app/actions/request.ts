"use server";

import { clientKey } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCustomer } from "@/lib/customer-session";
import { lookupLink } from "@/lib/ingest/run";
import { autoQuoteRequest, getItemTypes, getLinkAuto } from "@/lib/link-auto";
import { createLimiter } from "@/lib/throttle";
import { firstError, linkRequestSchema } from "@/lib/validation";

const limiter = createLimiter(6, 60 * 60 * 1000);

export type RequestState = {
  error?: string; done?: boolean; values?: Record<string, string>;
  /** set when the system priced the request by itself: the customer can pay straight away */
  quote?: { token: string; unitPriceMinor: number; source: "page" | "customer" };
};

export async function requestAction(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const values: Record<string, string> = {};
  for (const k of ["url", "title", "details", "quantity", "priceSeen", "itemType", "name", "phone", "email"]) {
    values[k] = String(formData.get(k) ?? "");
  }
  const parsed = linkRequestSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };
  const key = `request:${await clientKey()}`;
  if (!limiter.allowed(key)) return { error: "You have sent several requests recently. Please try again later.", values };
  limiter.record(key);
  const r = parsed.data;
  const customer = await getCustomer();
  const itemType = getItemTypes().some((t) => t.name === r.itemType) ? r.itemType : "";
  const info = db()
    .prepare(
      "INSERT INTO link_requests (url, title, details, quantity, price_seen, name, phone, email, customer_id, item_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(r.url, r.title, r.details, r.quantity, r.priceSeen, r.name, r.phone, r.email, customer?.id ?? null, itemType);
  const id = Number(info.lastInsertRowid);

  // Price it by itself when the admin's rules allow. A failure here only means a person quotes it, as before.
  try {
    let pagePrice: number | null = null;
    if (getLinkAuto().pageEnabled) {
      const seen = await lookupLink(r.url);
      if (seen.ok && seen.item.priceMinor > 0) pagePrice = seen.item.priceMinor;
    }
    const q = autoQuoteRequest(id, pagePrice);
    if (q.quoted) return { done: true, quote: { token: q.token, unitPriceMinor: q.unitPriceMinor, source: q.source } };
  } catch (e) {
    console.error("[request] automatic quote failed", e instanceof Error ? e.message : "unknown error");
  }
  return { done: true };
}
