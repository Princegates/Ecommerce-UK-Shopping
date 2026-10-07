import type Database from "better-sqlite3";
import { db } from "./db";
import { MAX_QUOTE_MINOR, MIN_QUOTE_MINOR, getLinkRequest, quoteRequest } from "./link-orders";
import { parseMinor } from "./money";
import { getSetting, setSetting } from "./settings";

type Db = Database.Database;

/**
 * Automatic quotes for link requests. The cost to the customer is always worked out from the admin's own values (exchange rate,
 * service charge, shipping rates, delivery fee). This decides whether the system may also fill in the two things a person would
 * otherwise type: the UK price and the weight.
 */

export type LinkAutoConfig = {
  /** quote by itself when the price was read from the shop's own page */
  pageEnabled: boolean;
  /** also quote by itself from the price the customer typed (it cannot be checked, so a margin is added) */
  customerEnabled: boolean;
  marginPct: number;
  /** above this UK price (per item) a person must quote */
  ceilingMinor: number;
  validDays: number;
};

export const DEFAULT_AUTO: LinkAutoConfig = { pageEnabled: true, customerEnabled: false, marginPct: 5, ceilingMinor: 15_000, validDays: 3 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

export function cleanAuto(c: Partial<LinkAutoConfig>): LinkAutoConfig {
  return {
    pageEnabled: c.pageEnabled ?? DEFAULT_AUTO.pageEnabled,
    customerEnabled: c.customerEnabled ?? DEFAULT_AUTO.customerEnabled,
    marginPct: Math.round(clamp(c.marginPct ?? DEFAULT_AUTO.marginPct, 0, 50) * 10) / 10,
    ceilingMinor: Math.round(clamp(c.ceilingMinor ?? DEFAULT_AUTO.ceilingMinor, 1000, MAX_QUOTE_MINOR)),
    validDays: Math.round(clamp(c.validDays ?? DEFAULT_AUTO.validDays, 1, 30)),
  };
}

export function getLinkAuto(d: Db = db()): LinkAutoConfig {
  return cleanAuto(getSetting<Partial<LinkAutoConfig>>("link_auto", d) ?? {});
}

export function saveLinkAuto(c: Partial<LinkAutoConfig>, d: Db = db()): LinkAutoConfig {
  const v = cleanAuto(c);
  setSetting("link_auto", v, d);
  return v;
}

// ------------------------------------------------------------------ item types and their weights

export type ItemType = { name: string; grams: number };

export const DEFAULT_ITEM_TYPES: ItemType[] = [
  { name: "Clothing", grams: 500 }, { name: "Shoes and boots", grams: 1200 }, { name: "Beauty and health", grams: 400 },
  { name: "Small electronics", grams: 800 }, { name: "Home and kitchen", grams: 2000 }, { name: "Toys and baby", grams: 1000 },
  { name: "Books", grams: 500 }, { name: "Sports and outdoors", grams: 1500 }, { name: "Other or not sure", grams: 1000 },
];

export function parseItemTypes(text: string): { ok: true; value: ItemType[] } | { ok: false; error: string } {
  const out: ItemType[] = [];
  const seen = new Set<string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(.+?)\s*[:=,]\s*(\d{1,6})\s*(g|grams)?$/i.exec(line);
    if (!m) return { ok: false, error: `“${line.slice(0, 40)}” should look like “Shoes and boots: 1200” (a name, then the weight in grams).` };
    const name = m[1].trim();
    const grams = Number(m[2]);
    if (name.length < 2 || name.length > 40) return { ok: false, error: "Each item type needs a name of 2 to 40 characters." };
    if (grams < 1 || grams > 50_000) return { ok: false, error: `The weight for “${name}” must be between 1 and 50,000 grams.` };
    if (seen.has(name.toLowerCase())) return { ok: false, error: `“${name}” is listed twice.` };
    seen.add(name.toLowerCase());
    out.push({ name, grams });
  }
  if (out.length === 0) return { ok: false, error: "List at least one item type." };
  if (out.length > 30) return { ok: false, error: "Use 30 item types or fewer." };
  return { ok: true, value: out };
}

export const itemTypesToText = (t: ItemType[]) => t.map((x) => `${x.name}: ${x.grams}`).join("\n");

export function getItemTypes(d: Db = db()): ItemType[] {
  const saved = getSetting<ItemType[]>("link_item_types", d);
  if (!Array.isArray(saved)) return DEFAULT_ITEM_TYPES;
  const ok = saved.filter((t) => t && typeof t.name === "string" && Number.isInteger(t.grams) && t.grams > 0);
  return ok.length ? ok : DEFAULT_ITEM_TYPES;
}

export function saveItemTypes(t: ItemType[], d: Db = db()): void {
  setSetting("link_item_types", t, d);
}

/** Weight for a chosen item type; unknown or empty falls back to the last type in the list (the catch-all). */
export function weightForType(name: string, d: Db = db()): number {
  const types = getItemTypes(d);
  return (types.find((t) => t.name === name) ?? types[types.length - 1]).grams;
}

// ------------------------------------------------------------------ deciding

export type AutoDecision =
  | { quote: true; source: "page" | "customer"; unitPriceMinor: number; basisMinor: number }
  | { quote: false; reason: string };

/** Pure rule: may the system quote by itself, and at what UK price? */
export function decideAutoQuote(cfg: LinkAutoConfig, input: { pagePriceMinor: number | null; customerPriceMinor: number | null }): AutoDecision {
  let source: "page" | "customer";
  let basis: number;
  let unit: number;
  if (input.pagePriceMinor !== null && cfg.pageEnabled) {
    source = "page";
    basis = input.pagePriceMinor;
    unit = basis;
  } else if (input.customerPriceMinor !== null && cfg.customerEnabled) {
    source = "customer";
    basis = input.customerPriceMinor;
    // whole numbers only: 10% of £30.00 must be exactly £33.00, never £33.01
    unit = Math.ceil((basis * (1000 + Math.round(cfg.marginPct * 10))) / 1000);
  } else {
    return { quote: false, reason: input.pagePriceMinor === null && input.customerPriceMinor === null ? "no price to go on" : "automatic quotes are off for this kind of price" };
  }
  if (basis < MIN_QUOTE_MINOR || unit > MAX_QUOTE_MINOR) return { quote: false, reason: "the price looks wrong" };
  if (unit > cfg.ceilingMinor) return { quote: false, reason: "above the automatic limit" };
  return { quote: true, source, unitPriceMinor: unit, basisMinor: basis };
}

/** Quotes a request by itself when the rules allow. `pagePriceMinor` is the price the system read from the shop's own page, if it could. */
export function autoQuoteRequest(
  id: number, pagePriceMinor: number | null, d: Db = db(), now = Date.now(),
): { quoted: true; token: string; source: "page" | "customer"; unitPriceMinor: number } | { quoted: false; reason: string } {
  const r = getLinkRequest(id, d);
  if (!r) return { quoted: false, reason: "no such request" };
  const cfg = getLinkAuto(d);
  const typed = r.priceSeen ? parseMinor(r.priceSeen) : null;
  const decision = decideAutoQuote(cfg, { pagePriceMinor, customerPriceMinor: typed });
  if (!decision.quote) return { quoted: false, reason: decision.reason };
  const note = decision.source === "customer"
    ? `Based on the price you gave (£${(decision.basisMinor / 100).toFixed(2)}) plus a ${cfg.marginPct}% safety margin. We check the shop's price before buying and will contact you if it is different.`
    : "Price read from the shop's website. We check it again before buying.";
  const q = quoteRequest(id, { unitPriceMinor: decision.unitPriceMinor, weightGrams: weightForType(r.itemType, d), validDays: cfg.validDays, note, source: decision.source, basisMinor: decision.basisMinor }, d, now);
  return q.ok ? { quoted: true, token: q.token, source: decision.source, unitPriceMinor: decision.unitPriceMinor } : { quoted: false, reason: q.error };
}
