import "server-only";
import { priceOrder } from "./price-order";
import { getSettings, getZones } from "./settings";
import type Database from "better-sqlite3";
import { db } from "./db";

/** A few typical baskets, priced with the saved pricing configuration, so an admin can see what a change does before customers do. */
const BASKETS: { name: string; category: string; gbp: number; kg: number }[] = [
  { name: "£25 top, 0.5 kg", category: "clothing_apparel", gbp: 25, kg: 0.5 },
  { name: "£80 kitchen item, 2 kg", category: "kitchen_home", gbp: 80, kg: 2 },
  { name: "£165 phone, 1 kg", category: "phones_tablets", gbp: 164.99, kg: 1 },
  { name: "£30 book set, 8 kg", category: "books_stationery", gbp: 29.99, kg: 8 },
  { name: "£250 trainers and a jacket, 3 kg", category: "footwear", gbp: 250, kg: 3 },
];

export type SampleQuote = {
  name: string;
  items: number;
  deliveryAndImport: number;
  total: number;
  contribution: number;
  contributionPct: number;
  flags: string[];
};

export function sampleQuotes(zoneKey?: string, d: Db0 = db()): SampleQuote[] {
  const s = getSettings(d);
  const zone = zoneKey ?? getZones(true, d).find((z) => z.pricingKey === "accra_central")?.pricingKey ?? "accra_central";
  return BASKETS.map((b) => {
    const p = priceOrder({
      items: [{ id: "x", unitPriceMinor: Math.round(b.gbp * 100), quantity: 1, weightGrams: Math.round(b.kg * 1000), category: b.category }],
      pricing: s.pricing, market: s.market, zoneKey: zone, ignoreMinOrder: true,
    });
    return {
      name: b.name,
      items: p.itemsGhsMinor + p.serviceFeeMinor,
      deliveryAndImport: p.shippingMinor + p.insuranceMinor + p.dutyMinor + p.deliveryMinor,
      total: p.totalMinor,
      contribution: Math.round(p.internal.contributionGhs * 100),
      contributionPct: p.internal.contributionPctOfTotal,
      flags: p.flags,
    };
  });
}

type Db0 = Database.Database;
