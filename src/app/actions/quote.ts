"use server";

import { getProductById } from "@/lib/catalog";
import { buildQuoteConfig } from "@/lib/quote-table";
import type { QuoteConfig } from "@/lib/quote-config";

/**
 * The prices for one item at a quantity, for every delivery area and shipping method. The item's price, weight and duty category are read
 * from the database here; nothing about money is taken from the browser.
 */
export async function quoteProductAction(productId: number, quantity: number): Promise<QuoteConfig["quotes"] | null> {
  const id = Math.trunc(Number(productId));
  const qty = Math.min(20, Math.max(1, Math.trunc(Number(quantity)) || 1));
  const p = Number.isFinite(id) ? getProductById(id) : null;
  if (!p || !p.active) return null;
  return buildQuoteConfig([{ id: String(p.id), unitPriceMinor: p.priceMinor, quantity: qty, weightGrams: p.weightGrams, category: p.dutyCategory }]).quotes;
}
