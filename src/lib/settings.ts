import type Database from "better-sqlite3";
import { z } from "zod";
import { db } from "./db";
import { THEMES } from "./themes";
import type { FxConfig } from "./pricing";
import { cleanSources, freshBog, type FxSources } from "./fx-sources";
import { customerRate, DEFAULT_PRICING_CONFIG, parsePricingConfig, type PricingConfig } from "./quote-engine";

type Db = Database.Database;


/** What the pricing needs to know about the money markets: the shop's market rate, the customs (Bank of Ghana) rate, and how much the rate moved in 3 days. */
export type MarketContext = { mid: number; customs: number; move3d: number };

export type Settings = {
  siteName: string;
  /**
   * The rate customers are charged at: the market rate plus the markup the pricing configuration sets (more in a volatile week).
   * Everything customer-facing converts pounds to cedis with this, so `markupPct` is always 0.
   */
  fx: FxConfig;
  /** The market rate, the customs rate and the 3-day move, from which `fx` is worked out. */
  market: MarketContext;
  /** Where the customs rate comes from: an admin's own figure, the Bank of Ghana's official rate, or (failing both) the market rate. */
  customsSource: "manual" | "bank_of_ghana" | "market";
  /** The latest reading from each exchange-rate source. */
  fxSources: FxSources;
  /** Every number the pricing uses: service charge, shipping, insurance, duties, delivery and the shop's internal costs. */
  pricing: PricingConfig;
  supportWhatsapp: string;
  /** Where customers write about privacy, deletion and complaints. Shown in the privacy policy and terms. */
  supportEmail: string;
  /** The registered name of the business running the shop, if different from the shop name. Shown in the privacy policy and terms. */
  legalName: string;
  /** The business's registration numbers with the data-protection regulators, for the privacy policy. Empty until the owner enters them. */
  dpcRegNo: string;
  icoRegNo: string;
  theme: string;
};

const DEFAULTS = {
  site_name: "YenkoExpress",
  fx_rate: 15,
  support_whatsapp: "",
  support_email: "",
  legal_name: "",
  theme: "ghana",
};

function readRaw(d: Db): Record<string, unknown> {
  const rows = d.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      // ignore a corrupt row and fall back to the default
    }
  }
  return out;
}

/** How far the market rate moved over the last three days, as a fraction (0.02 is 2%); 0 until there is enough history. */
export function rateMove3d(mid: number, d: Db = db()): number {
  const old = d.prepare("SELECT rate FROM fx_rate_history WHERE changed_at <= datetime('now', '-3 days') ORDER BY id DESC LIMIT 1").get() as { rate: number } | undefined;
  const first = old ?? (d.prepare("SELECT rate FROM fx_rate_history ORDER BY id ASC LIMIT 1").get() as { rate: number } | undefined);
  return first && first.rate > 0 ? Math.abs(mid / first.rate - 1) : 0;
}

export function getSettings(d: Db = db()): Settings {
  const raw = readRaw(d);
  const rate = z.number().positive().safeParse(raw.fx_rate);
  const mid = rate.success ? rate.data : DEFAULTS.fx_rate;
  const customs = z.number().positive().safeParse(raw.customs_rate);
  const fxSources = cleanSources(raw.fx_sources);
  const bog = freshBog(fxSources, new Date());
  const customsSource = customs.success ? "manual" : bog ? "bank_of_ghana" : "market";
  const customsRate = customs.success ? customs.data : bog ? bog.rate : mid;
  const cfg = parsePricingConfig(raw.pricing_config);
  const pricing = cfg.ok ? cfg.value : DEFAULT_PRICING_CONFIG;
  const move3d = rateMove3d(mid, d);
  return {
    siteName: z.string().min(1).catch(DEFAULTS.site_name).parse(raw.site_name),
    fx: { rate: customerRate(mid, move3d, pricing).rate, markupPct: 0 },
    market: { mid, customs: customsRate, move3d },
    customsSource,
    fxSources,
    pricing,
    supportWhatsapp: z.string().catch("").parse(raw.support_whatsapp),
    supportEmail: z.string().catch("").parse(raw.support_email),
    legalName: z.string().catch("").parse(raw.legal_name),
    dpcRegNo: z.string().catch("").parse(raw.dpc_reg_no),
    icoRegNo: z.string().catch("").parse(raw.ico_reg_no),
    theme: typeof raw.theme === "string" && THEMES.some((x) => x.id === raw.theme) ? raw.theme : DEFAULTS.theme,
  };
}

export function getSetting<T = unknown>(key: string, d: Db = db()): T | undefined {
  const row = d.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return undefined;
  }
}

export function setSetting(key: string, value: unknown, d: Db = db()): void {
  d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, JSON.stringify(value));
}

/** How an order travels. Air always; economy sea only when the pricing configuration turns it on. Not stored: it follows the configuration. */
export type ShippingMethod = {
  id: number;
  code: "air" | "sea";
  name: string;
  eta: string;
  active: boolean;
};

export function getShippingMethods(_activeOnly?: boolean, d: Db = db()): ShippingMethod[] {
  const { shipping } = getSettings(d).pricing;
  const methods: ShippingMethod[] = [{ id: 1, code: "air", name: "Air freight", eta: shipping.airTransit, active: true }];
  if (shipping.sea.enabled) methods.push({ id: 2, code: "sea", name: "Economy sea freight", eta: shipping.sea.transit, active: true });
  return methods;
}

export function getShippingMethod(code: string, d: Db = db()): ShippingMethod | null {
  return getShippingMethods(true, d).find((m) => m.code === code) ?? null;
}

export type DeliveryZone = {
  id: number;
  name: string;
  areas: string;
  /** Which delivery price in the pricing configuration applies here (a key of its `delivery` list). */
  pricingKey: string;
  eta: string;
  active: boolean;
};

type ZoneRow = { id: number; name: string; areas: string; pricing_key: string; eta: string; active: number };

const toZone = (r: ZoneRow): DeliveryZone => ({
  id: r.id,
  name: r.name,
  areas: r.areas,
  pricingKey: r.pricing_key || "other_regions",
  eta: r.eta,
  active: r.active === 1,
});

export function getZones(activeOnly = true, d: Db = db()): DeliveryZone[] {
  const rows = d
    .prepare(`SELECT * FROM delivery_zones ${activeOnly ? "WHERE active = 1" : ""} ORDER BY sort, id`)
    .all() as ZoneRow[];
  return rows.map(toZone);
}

export function getZone(id: number, d: Db = db()): DeliveryZone | null {
  const r = d.prepare("SELECT * FROM delivery_zones WHERE id = ? AND active = 1").get(id) as ZoneRow | undefined;
  return r ? toZone(r) : null;
}
