import "server-only";
import type Database from "better-sqlite3";
import { db } from "./db";
import { priceOrder } from "./price-order";
import type { PricingConfig } from "./quote-engine";
import { getSettings, getShippingMethods, getZones, type MarketContext } from "./settings";

type Db = Database.Database;

/** Server only. It carries the pricing configuration, so it must never be passed to a browser component. */
export type DeliveryContext = {
  zoneId: number;
  zoneName: string;
  zoneKey: string;
  methodName: string;
  pricing: PricingConfig;
  market: MarketContext;
};

/**
 * The delivery area and shipping method used to show "to your door" prices across the shop.
 * Uses the requested area when it is still offered, else the first one; the first active shipping method.
 */
export function buildDeliveryContext(preferredZoneId: number | null | undefined, d: Db = db()): DeliveryContext | null {
  const zones = getZones(true, d);
  const methods = getShippingMethods(true, d);
  const zone = zones.find((z) => z.id === preferredZoneId) ?? zones[0];
  const method = methods[0];
  if (!zone || !method) return null;
  const s = getSettings(d);
  return { zoneId: zone.id, zoneName: zone.name, zoneKey: zone.pricingKey, methodName: method.name, pricing: s.pricing, market: s.market };
}

/** What one of this item costs delivered, all in: the item, service charge, shipping, insurance, import duties and delivery. */
export function landedMinor(item: { priceMinor: number; weightGrams: number; dutyCategory: string }, ctx: DeliveryContext, quantity = 1): number {
  return priceOrder({
    items: [{ id: "x", unitPriceMinor: item.priceMinor, quantity, weightGrams: item.weightGrams, category: item.dutyCategory }],
    pricing: ctx.pricing,
    market: ctx.market,
    zoneKey: ctx.zoneKey,
    ignoreMinOrder: true,
  }).totalMinor;
}
