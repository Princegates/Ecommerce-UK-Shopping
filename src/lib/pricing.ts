/**
 * Money conversion between pounds (pence) and cedis (pesewas). Pure and safe to use in the browser.
 *
 * What a whole order costs (service charge, shipping, insurance, import duties, delivery) is worked out by the quote engine
 * (`quote-engine.ts`, server only) through `price-order.ts`. All money is integer minor units.
 */

export type FxConfig = {
  /** GHS per 1 GBP, e.g. 15.2 */
  rate: number;
  /** Markup applied on top of the rate, in percent, e.g. 3.5 */
  markupPct: number;
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
