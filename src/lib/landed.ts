import type Database from "better-sqlite3";
import { db } from "./db";
import { priceOrder, type FxConfig, type RateCard, type ServiceFeeRule } from "./pricing";
import { getSettings, getShippingMethods, getZones } from "./settings";

type Db = Database.Database;

export type DeliveryContext = {
  zoneId: number;
  zoneName: string;
  deliveryFeeMinor: number;
  methodName: string;
  rateCard: RateCard;
  fx: FxConfig;
  serviceFee: ServiceFeeRule;
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
  return {
    zoneId: zone.id, zoneName: zone.name, deliveryFeeMinor: zone.feeMinor, methodName: method.name, rateCard: method.rateCard,
    fx: s.fx, serviceFee: s.serviceFee,
  };
}

/** What one of this item costs delivered: item, service charge, shipping and delivery. */
export function landedMinor(item: { priceMinor: number; weightGrams: number }, ctx: DeliveryContext, quantity = 1): number {
  return priceOrder({
    items: [{ id: "x", unitPriceMinor: item.priceMinor, quantity, weightGrams: item.weightGrams }],
    fx: ctx.fx,
    serviceFee: ctx.serviceFee,
    rateCard: ctx.rateCard,
    deliveryFeeMinor: ctx.deliveryFeeMinor,
  }).totalMinor;
}
