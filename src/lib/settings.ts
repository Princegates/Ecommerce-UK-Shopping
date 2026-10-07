import type Database from "better-sqlite3";
import { z } from "zod";
import { db } from "./db";
import type { FxConfig, RateCard, ServiceFeeRule } from "./pricing";

type Db = Database.Database;

const percent = z.number().min(0).max(100);
const minor = z.number().int().min(0);

export const serviceFeeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("percent"), percent, minMinor: minor }),
  z.object({ mode: z.literal("fixed"), fixedMinor: minor }),
  z.object({
    mode: z.literal("tiered"),
    minMinor: minor,
    tiers: z
      .array(z.object({ upToGbpMinor: minor.nullable(), percent }))
      .min(1),
  }),
]);

export const rateCardSchema = z.object({
  brackets: z.array(z.object({ upToGrams: z.number().int().positive(), priceMinor: minor })).min(1),
  extraPerKgMinor: minor,
  minChargeMinor: minor,
});

export type Settings = {
  siteName: string;
  fx: FxConfig;
  serviceFee: ServiceFeeRule;
  minOrderGbpMinor: number;
  supportWhatsapp: string;
};

const DEFAULTS = {
  site_name: "Akwaaba UK",
  fx_rate: 15,
  fx_markup_pct: 0,
  service_fee: { mode: "percent", percent: 10, minMinor: 0 } as ServiceFeeRule,
  min_order_gbp_minor: 0,
  support_whatsapp: "",
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

export function getSettings(d: Db = db()): Settings {
  const raw = readRaw(d);
  const fee = serviceFeeSchema.safeParse(raw.service_fee);
  const rate = z.number().positive().safeParse(raw.fx_rate);
  const markup = percent.safeParse(raw.fx_markup_pct);
  return {
    siteName: z.string().min(1).catch(DEFAULTS.site_name).parse(raw.site_name),
    fx: {
      rate: rate.success ? rate.data : DEFAULTS.fx_rate,
      markupPct: markup.success ? markup.data : DEFAULTS.fx_markup_pct,
    },
    serviceFee: fee.success ? fee.data : DEFAULTS.service_fee,
    minOrderGbpMinor: minor.catch(DEFAULTS.min_order_gbp_minor).parse(raw.min_order_gbp_minor),
    supportWhatsapp: z.string().catch("").parse(raw.support_whatsapp),
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

export type ShippingMethod = {
  id: number;
  code: string;
  name: string;
  eta: string;
  active: boolean;
  rateCard: RateCard;
};

type MethodRow = { id: number; code: string; name: string; eta: string; rate_card: string; active: number };

function toMethod(r: MethodRow): ShippingMethod {
  const parsed = rateCardSchema.safeParse(JSON.parse(r.rate_card));
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    eta: r.eta,
    active: r.active === 1,
    rateCard: parsed.success
      ? parsed.data
      : { brackets: [{ upToGrams: 1000, priceMinor: 0 }], extraPerKgMinor: 0, minChargeMinor: 0 },
  };
}

export function getShippingMethods(activeOnly = true, d: Db = db()): ShippingMethod[] {
  const rows = d
    .prepare(`SELECT * FROM shipping_methods ${activeOnly ? "WHERE active = 1" : ""} ORDER BY sort, id`)
    .all() as MethodRow[];
  return rows.map(toMethod);
}

export function getShippingMethod(code: string, d: Db = db()): ShippingMethod | null {
  const r = d.prepare("SELECT * FROM shipping_methods WHERE code = ? AND active = 1").get(code) as MethodRow | undefined;
  return r ? toMethod(r) : null;
}

export type DeliveryZone = {
  id: number;
  name: string;
  areas: string;
  feeMinor: number;
  eta: string;
  active: boolean;
};

type ZoneRow = { id: number; name: string; areas: string; fee_minor: number; eta: string; active: number };

const toZone = (r: ZoneRow): DeliveryZone => ({
  id: r.id,
  name: r.name,
  areas: r.areas,
  feeMinor: r.fee_minor,
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
