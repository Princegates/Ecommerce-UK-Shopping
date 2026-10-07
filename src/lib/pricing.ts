/**
 * Pricing engine. Pure functions only (no I/O) so the same code prices the
 * product-page estimator, the cart, checkout and the stored order.
 *
 * Customer total = items + service charge + international shipping + Ghana delivery.
 * All money is integer minor units: pence (GBP) and pesewas (GHS).
 */

export type ServiceFeeRule =
  | { mode: "percent"; percent: number; minMinor: number }
  | { mode: "fixed"; fixedMinor: number }
  | {
      mode: "tiered";
      /** Ordered bands on the GBP item total; `upToGbpMinor: null` is the open-ended last band. */
      tiers: { upToGbpMinor: number | null; percent: number }[];
      minMinor: number;
    };

export type FxConfig = {
  /** GHS per 1 GBP, e.g. 15.2 */
  rate: number;
  /** Markup applied on top of the rate, in percent, e.g. 3.5 */
  markupPct: number;
};

export type RateCard = {
  /** Ascending weight brackets: a parcel up to `upToGrams` costs `priceMinor` (GHS). */
  brackets: { upToGrams: number; priceMinor: number }[];
  /** Charge per started kg above the largest bracket. */
  extraPerKgMinor: number;
  minChargeMinor: number;
};

export type PriceableItem = {
  id: string;
  unitPriceMinor: number; // GBP pence, retailer price
  quantity: number;
  weightGrams: number;
  /** Volumetric weight in grams, where known. Chargeable weight is the greater of the two. */
  volumetricGrams?: number;
};

export type PriceInput = {
  items: PriceableItem[];
  fx: FxConfig;
  serviceFee: ServiceFeeRule;
  rateCard: RateCard;
  deliveryFeeMinor: number;
};

export type PriceBreakdown = {
  lines: { id: string; gbpMinor: number; ghsMinor: number }[];
  itemsGbpMinor: number;
  itemsGhsMinor: number;
  serviceFeeMinor: number;
  shippingMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  chargeableGrams: number;
  effectiveRate: number;
};

const RATE_SCALE = 10_000n;

/** Round-half-up integer division for non-negative BigInts. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

export function effectiveRate({ rate, markupPct }: FxConfig): number {
  return Math.round(rate * 10_000) * (10_000 + Math.round(markupPct * 100)) / 1e8;
}

/** Convert GBP pence to GHS pesewas, rounding half up once. */
export function gbpToGhsMinor(gbpMinor: number, fx: FxConfig): number {
  if (gbpMinor <= 0) return 0;
  const rateE4 = BigInt(Math.round(fx.rate * 10_000));
  const factorE4 = BigInt(10_000 + Math.round(fx.markupPct * 100));
  return Number(divRound(BigInt(gbpMinor) * rateE4 * factorE4, RATE_SCALE * RATE_SCALE));
}

/** Convert GHS pesewas back to GBP pence at the same effective rate, rounding half up. */
export function ghsToGbpMinor(ghsMinor: number, fx: FxConfig): number {
  if (ghsMinor <= 0) return 0;
  const rateE4 = BigInt(Math.round(fx.rate * 10_000));
  const factorE4 = BigInt(10_000 + Math.round(fx.markupPct * 100));
  return Number(divRound(BigInt(ghsMinor) * RATE_SCALE * RATE_SCALE, rateE4 * factorE4));
}

export function serviceFeeMinor(
  rule: ServiceFeeRule,
  itemsGhsMinor: number,
  itemsGbpMinor: number,
): number {
  if (itemsGbpMinor <= 0) return 0;
  switch (rule.mode) {
    case "fixed":
      return rule.fixedMinor;
    case "percent":
      return Math.max(rule.minMinor, pct(itemsGhsMinor, rule.percent));
    case "tiered": {
      const tier =
        rule.tiers.find((t) => t.upToGbpMinor === null || itemsGbpMinor <= t.upToGbpMinor) ??
        rule.tiers[rule.tiers.length - 1];
      return Math.max(rule.minMinor, tier ? pct(itemsGhsMinor, tier.percent) : 0);
    }
  }
}

function pct(minor: number, percent: number): number {
  return Number(divRound(BigInt(minor) * BigInt(Math.round(percent * 100)), 10_000n));
}

export function chargeableGrams(items: PriceableItem[]): number {
  return items.reduce(
    (sum, i) => sum + Math.max(i.weightGrams, i.volumetricGrams ?? 0) * i.quantity,
    0,
  );
}

export function shippingMinor(card: RateCard, grams: number): number {
  if (grams <= 0) return 0;
  const brackets = [...card.brackets].sort((a, b) => a.upToGrams - b.upToGrams);
  const hit = brackets.find((b) => grams <= b.upToGrams);
  let price: number;
  if (hit) {
    price = hit.priceMinor;
  } else {
    const top = brackets[brackets.length - 1];
    const extraKg = Math.ceil((grams - (top?.upToGrams ?? 0)) / 1000);
    price = (top?.priceMinor ?? 0) + extraKg * card.extraPerKgMinor;
  }
  return Math.max(card.minChargeMinor, price);
}

export function priceOrder(input: PriceInput): PriceBreakdown {
  const lines = input.items.map((i) => {
    const gbpMinor = i.unitPriceMinor * i.quantity;
    return { id: i.id, gbpMinor, ghsMinor: gbpToGhsMinor(gbpMinor, input.fx) };
  });
  const itemsGbpMinor = lines.reduce((s, l) => s + l.gbpMinor, 0);
  const itemsGhsMinor = lines.reduce((s, l) => s + l.ghsMinor, 0);
  const grams = chargeableGrams(input.items);
  const hasItems = itemsGbpMinor > 0;
  const service = serviceFeeMinor(input.serviceFee, itemsGhsMinor, itemsGbpMinor);
  const shipping = shippingMinor(input.rateCard, grams);
  const delivery = hasItems ? input.deliveryFeeMinor : 0;
  return {
    lines,
    itemsGbpMinor,
    itemsGhsMinor,
    serviceFeeMinor: service,
    shippingMinor: shipping,
    deliveryMinor: delivery,
    totalMinor: itemsGhsMinor + service + shipping + delivery,
    chargeableGrams: grams,
    effectiveRate: effectiveRate(input.fx),
  };
}

export function describeServiceFee(rule: ServiceFeeRule): string {
  switch (rule.mode) {
    case "fixed":
      return "Flat service charge";
    case "percent":
      return `${rule.percent}% service charge`;
    case "tiered":
      return "Service charge";
  }
}
