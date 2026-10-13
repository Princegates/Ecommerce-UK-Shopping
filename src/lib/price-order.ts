import "server-only";
import type { CustomerBreakdown } from "./quote-config";
import { quote, type InternalView, type PricingConfig, type QuoteLine } from "./quote-engine";
import type { MarketContext } from "./settings";

/**
 * Prices a whole order with the quote engine and turns its decimal results into the shop's integer pesewas.
 * Server only: the result carries the shop's internal working, which must never reach a browser. Send `customerOf(breakdown)` instead.
 */

export type PriceableItem = {
  id: string;
  unitPriceMinor: number; // GBP pence, retailer price
  quantity: number;
  weightGrams: number;
  /** Volumetric weight in grams, where known. Chargeable weight is the greater of the two. */
  volumetricGrams?: number;
  /** An import-duty category id from the pricing configuration. */
  category: string;
};

export type PriceInput = {
  items: PriceableItem[];
  pricing: PricingConfig;
  market: MarketContext;
  /** The pricing key of the delivery area, such as accra_central. */
  zoneKey: string;
  service?: "air" | "sea";
  /** For a product-page estimate of a single item. */
  ignoreMinOrder?: boolean;
};

export type PriceBreakdown = {
  /** One per item: the pounds, and the customer's line total in pesewas (the item at the rate, plus its share of the service charge). */
  lines: { id: string; gbpMinor: number; ghsMinor: number }[];
  itemsGbpMinor: number;
  /** The items alone, at the customer rate. The service charge is separate here and inside the item prices in the customer view. */
  itemsGhsMinor: number;
  serviceFeeMinor: number;
  shippingMinor: number;
  insuranceMinor: number;
  /** Import duties and taxes, paid by the shop at the port on the customer's behalf. */
  dutyMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  chargeableGrams: number;
  effectiveRate: number;
  service: "air" | "sea";
  estimatedDelivery: string;
  /** Reasons staff should look at the order (an unknown category, a high-value phone, a floor top-up and so on). */
  flags: string[];
  below: { minimumOrder: boolean; overWeight: boolean };
  /** The shop's own costs and contribution. Never send this to a browser. */
  internal: InternalView;
};

const minor = (cedis: number) => Math.round(cedis * 100);

export function priceOrder(input: PriceInput): PriceBreakdown {
  const lines: QuoteLine[] = input.items.map((i) => ({
    sku: i.id,
    category: i.category,
    unitGbp: i.unitPriceMinor / 100,
    qty: i.quantity,
    weightKg: Math.max(i.weightGrams, i.volumetricGrams ?? 0) / 1000,
  }));
  // The engine converts at the customer rate it works out from the market rate: the same figure as `Settings.fx`, so the two agree.
  const q = quote({ zone: input.zoneKey, lines }, { midGbpGhs: input.market.mid, customsGbpGhs: input.market.customs, move3d: input.market.move3d }, {
    ignoreMinOrder: input.ignoreMinOrder,
    service: input.service,
  }, input.pricing);
  const c = q.customerView;
  const n = q.internal;

  const hasItems = input.items.some((i) => i.unitPriceMinor * i.quantity > 0);
  const itemsGhsMinor = hasItems ? minor(n.goodsGhs) : 0;
  const serviceFeeMinor = hasItems ? minor(n.serviceGhs) : 0;
  const shippingMinor = hasItems ? minor(n.shippingGhs) : 0;
  const insuranceMinor = hasItems ? minor(n.insuranceGhs) : 0;
  const dutyMinor = hasItems ? minor(n.taxChargedGhs) : 0;
  // UK delivery fees are not collected today (no item carries one), so any such amount rides with delivery
  const deliveryMinor = hasItems ? minor(n.deliveryGhs) + minor(n.ukDelGhs) : 0;
  const totalMinor = itemsGhsMinor + serviceFeeMinor + shippingMinor + insuranceMinor + dutyMinor + deliveryMinor;

  // customer line totals, made to add up to the items-plus-service amount exactly
  const itemsPlusService = itemsGhsMinor + serviceFeeMinor;
  const lineMinors = c.items.map((l) => minor(l.lineTotalGhs));
  if (lineMinors.length > 0) lineMinors[lineMinors.length - 1] += itemsPlusService - lineMinors.reduce((a, b) => a + b, 0);

  return {
    lines: input.items.map((i, idx) => ({ id: i.id, gbpMinor: i.unitPriceMinor * i.quantity, ghsMinor: hasItems ? lineMinors[idx] ?? 0 : 0 })),
    itemsGbpMinor: input.items.reduce((s, i) => s + i.unitPriceMinor * i.quantity, 0),
    itemsGhsMinor,
    serviceFeeMinor,
    shippingMinor,
    insuranceMinor,
    dutyMinor,
    deliveryMinor,
    totalMinor,
    chargeableGrams: Math.round(n.billableKg * 1000),
    effectiveRate: n.rate,
    service: c.service === "economy_sea" ? "sea" : "air",
    estimatedDelivery: c.estimatedDelivery,
    flags: n.flags,
    below: { minimumOrder: n.flags.includes("below_minimum_order"), overWeight: n.flags.some((f) => f.startsWith("over_weight_limit")) },
    internal: n,
  };
}

export function customerOf(b: PriceBreakdown): CustomerBreakdown {
  return {
    itemsGbpMinor: b.itemsGbpMinor,
    itemsMinor: b.itemsGhsMinor + b.serviceFeeMinor,
    deliveryAndImportMinor: b.shippingMinor + b.insuranceMinor + b.dutyMinor + b.deliveryMinor,
    totalMinor: b.totalMinor,
    estimatedDelivery: b.estimatedDelivery,
    service: b.service,
    belowMinimumOrder: b.below.minimumOrder,
    overWeight: b.below.overWeight,
    lines: b.lines.map((l) => ({ id: l.id, ghsMinor: l.ghsMinor })),
  };
}
