"use server";

import { clientKey } from "@/lib/auth";
import { db } from "@/lib/db";
import { createLimiter } from "@/lib/throttle";
import { firstError, linkRequestSchema } from "@/lib/validation";

const limiter = createLimiter(6, 60 * 60 * 1000);

export type RequestState = { error?: string; done?: boolean; values?: Record<string, string> };

export async function requestAction(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const values: Record<string, string> = {};
  for (const k of ["url", "title", "details", "quantity", "priceSeen", "name", "phone", "email"]) {
    values[k] = String(formData.get(k) ?? "");
  }
  const parsed = linkRequestSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };
  const key = `request:${await clientKey()}`;
  if (!limiter.allowed(key)) return { error: "You have sent several requests recently. Please try again later.", values };
  limiter.record(key);
  const r = parsed.data;
  db()
    .prepare(
      "INSERT INTO link_requests (url, title, details, quantity, price_seen, name, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(r.url, r.title, r.details, r.quantity, r.priceSeen, r.name, r.phone, r.email);
  return { done: true };
}
