import type { FxConfig } from "./pricing";

/**
 * What a browser is allowed to know about the price of an order: three amounts and a few words. No costs, no duty rates, no
 * margins. The shop's own working stays on the server (see `price-order.ts`).
 */
export type CustomerBreakdown = {
  itemsGbpMinor: number;
  /** Items at the customer rate, with the service charge included in the item prices. */
  itemsMinor: number;
  /** Shipping, cargo insurance, import duties and taxes, and delivery to the door, as one line. */
  deliveryAndImportMinor: number;
  totalMinor: number;
  estimatedDelivery: string;
  service: "air" | "sea";
  belowMinimumOrder: boolean;
  overWeight: boolean;
  /** Customer line totals by item id. */
  lines: { id: string; ghsMinor: number }[];
};

/**
 * The cart, checkout, quote and product pages let the customer switch delivery area and shipping method without a round trip, so
 * the server prices the same items for every area and method up front and sends the finished customer amounts.
 */
export type QuoteConfig = {
  /** The customer rate, for showing pounds next to cedis. */
  fx: FxConfig;
  /** The minimum order of items, in pesewas, before the service charge. */
  minOrderMinor: number;
  methods: { code: string; name: string; eta: string }[];
  zones: { id: number; name: string; areas: string; eta: string }[];
  /** Customer amounts for each delivery area and shipping method, keyed `${zoneId}:${code}`. */
  quotes: Record<string, CustomerBreakdown>;
  /** When the prices stop being held for this shopper (ISO time), or null. */
  lockedUntil: string | null;
  /** New quotes are on hold while the exchange-rate sources are being checked. */
  frozen: boolean;
};

export const quoteKey = (zoneId: number, code: string) => `${zoneId}:${code}`;

/** The customer amounts of an order already placed, from the figures stored with it. */
export function customerOfOrder(o: {
  itemsGbpMinor: number; itemsGhsMinor: number; serviceFeeMinor: number; shippingMinor: number; insuranceMinor: number; dutyMinor: number; deliveryMinor: number; totalMinor: number;
}) {
  return {
    itemsGbpMinor: o.itemsGbpMinor,
    itemsMinor: o.itemsGhsMinor + o.serviceFeeMinor,
    deliveryAndImportMinor: o.shippingMinor + o.insuranceMinor + o.dutyMinor + o.deliveryMinor,
    totalMinor: o.totalMinor,
  };
}
