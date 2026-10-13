import "server-only";
import type Database from "better-sqlite3";
import { db } from "./db";
import { customerOf, priceOrder, type PriceableItem } from "./price-order";
import { quoteKey, type QuoteConfig } from "./quote-config";
import type { QuoteMarket } from "./rate-lock";
import { getSettings, getShippingMethods, getZones } from "./settings";

type Db = Database.Database;

/** Prices these items for every delivery area and shipping method, and returns only what customers may see. */
/** Prices at the held rate when one is given, else at the live rate. */
export function buildQuoteConfig(items: PriceableItem[], qm?: QuoteMarket, d: Db = db()): QuoteConfig {
  const settings = getSettings(d);
  const market = qm?.market ?? settings.market;
  const zones = getZones(true, d);
  const methods = getShippingMethods(true, d);
  const quotes: QuoteConfig["quotes"] = {};
  for (const z of zones) {
    for (const m of methods) {
      quotes[quoteKey(z.id, m.code)] = customerOf(
        priceOrder({ items, pricing: settings.pricing, market, zoneKey: z.pricingKey, service: m.code }),
      );
    }
  }
  return {
    fx: qm?.fx ?? settings.fx,
    minOrderMinor: Math.round(settings.pricing.minOrderGhs * 100),
    methods: methods.map((m) => ({ code: m.code, name: m.name, eta: m.eta })),
    zones: zones.map((z) => ({ id: z.id, name: z.name, areas: z.areas, eta: z.eta })),
    quotes,
    lockedUntil: qm?.lockedUntil ?? null,
    frozen: qm?.frozen ?? false,
  };
}
