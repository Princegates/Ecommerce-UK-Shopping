"use server";

import { redirect } from "next/navigation";
import { clientKey } from "@/lib/auth";
import { getCustomer } from "@/lib/customer-session";
import { lookupLink } from "@/lib/ingest/run";
import { submitLinkRequest } from "@/lib/link-submit";
import { createLimiter } from "@/lib/throttle";
import { firstError, linkRequestSchema } from "@/lib/validation";

const limiter = createLimiter(6, 60 * 60 * 1000);

async function readPagePrice(url: string): Promise<number | null> {
  const seen = await lookupLink(url);
  return seen.ok && seen.item.priceMinor > 0 ? seen.item.priceMinor : null;
}

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
  const out = await submitLinkRequest(r, customer?.id ?? null, readPagePrice);
  if (out.quote) return { done: true, quote: out.quote };
  return { done: true };
}


/**
 * One click from the "we found it" box: the signed-in customer's details are used, the price is read from the shop's page again
 * on the server (a price sent from the browser is never trusted), and the customer goes straight to their price and payment.
 */
export async function quickLinkAction(formData: FormData): Promise<void> {
  const url = String(formData.get("url") ?? "").trim().slice(0, 500);
  const title = String(formData.get("title") ?? "").trim().slice(0, 150);
  const back = `/request?${new URLSearchParams({ url, title }).toString()}`;
  const customer = await getCustomer();
  if (!customer) redirect(`/login?next=${encodeURIComponent(back)}`);
  const quantity = Math.min(20, Math.max(1, Math.round(Number(formData.get("quantity")) || 1)));
  const parsed = linkRequestSchema.safeParse({
    url, title, details: String(formData.get("details") ?? ""), quantity, priceSeen: "", itemType: String(formData.get("itemType") ?? ""),
    name: customer.name, phone: customer.phone, email: customer.email ?? "",
  });
  if (!parsed.success) redirect(back);
  const key = `request:${await clientKey()}`;
  if (!limiter.allowed(key)) redirect(back);
  limiter.record(key);
  const out = await submitLinkRequest(parsed.data, customer.id, readPagePrice);
  redirect(out.quote ? `/quote/${out.quote.token}` : "/account#requests");
}
