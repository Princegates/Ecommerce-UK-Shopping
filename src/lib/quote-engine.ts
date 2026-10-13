/**
 * The quote engine: one cart in, two views out.
 *
 * - `customerView` is what the storefront shows: item prices (which carry the service charge), one all-in
 *   "delivery, insurance and import duties" line, and the total.
 * - `internal` is the shop's own working: costs, duty planning, contribution and review flags. It is never
 *   sent to a browser.
 *
 * It is a port of the reference implementation supplied with the pricing configuration, so that the numbers
 * match it exactly. Every number lives in the pricing configuration (see `pricing-config.default.json`).
 * Pure functions, no I/O. Amounts are in whole cedis and pounds (decimal); `price-adapter.ts` turns them into
 * the shop's integer minor units.
 */
import { z } from "zod";
import defaultConfig from "./pricing-config.default.json";

// ------------------------------------------------------------------ configuration

const frac = z.number().min(0).max(1);
const money = z.number().min(0);

export const pricingConfigSchema = z.object({
  version: z.string().min(1).max(60),
  notes: z.string().max(2000).optional(),
  fx: z.object({
    baseMarkup: frac,
    volTiers: z.array(z.object({ maxMove3d: z.number().min(0), add: frac })).min(1),
    assumedConversionCost: frac,
    minOverCost: frac,
    quoteTtlMinutes: z.number().int().min(1).max(1440),
    divergenceFreezePct: frac,
  }),
  minOrderGhs: money,
  serviceCharge: z.object({
    marginalTiers: z.array(z.object({ upToGhs: money.nullable(), pct: frac })).min(1),
    minGhs: money,
    capGhs: money,
  }),
  shipping: z.object({
    bands: z.array(z.object({ maxKg: z.number().positive(), ghs: money })).min(1),
    perKgAbove10Ghs: money,
    stepKg: z.number().positive(),
    volumetricDivisor: z.number().positive(),
    maxKgPerParcel: z.number().positive(),
    declaredFreightGbpPerKg: money,
    benchmarkNote: z.string().max(2000).optional(),
    sea: z.object({
      enabled: z.boolean(),
      ratePerKgGhs: money,
      minGhs: money,
      minBillableKg: z.number().min(0),
      declaredFreightGbpPerKg: money,
      transit: z.string().max(200),
      note: z.string().max(2000).optional(),
    }),
    airTransit: z.string().max(300),
  }),
  insurance: z.object({ pct: frac, minGhs: money, costPct: frac }),
  delivery: z.record(z.string().regex(/^[a-z0-9_]{1,40}$/), z.union([money, z.object({ base: money, perKgOver2: money })])),
  tax: z.object({ levyPctOfCif: frac, vatStackPct: frac, bufferPct: frac, actualVsPlanning: z.number().min(0).max(2), notes: z.string().max(2000).optional() }),
  internalCosts: z.object({
    forwarderGbpPerKg: money,
    clearanceGhsPerOrder: money,
    pspPct: frac,
    lossProvisionPct: frac,
    vatOnFees: z.boolean(),
    vatInclusiveFactor: frac,
    lastMileGhs: z.record(z.string(), money),
    supportGhsPerOrder: money,
    marketingGbpPerOrder: money,
    seaForwarderGbpPerKg: money,
  }),
  categories: z.array(z.object({ id: z.string().regex(/^[a-z0-9_]{1,40}$/), label: z.string().min(1).max(100), duty: frac, flags: z.array(z.string().max(40)) })).min(1),
  contributionFloorGhs: money,
});

export type PricingConfig = z.infer<typeof pricingConfigSchema>;

export const DEFAULT_PRICING_CONFIG: PricingConfig = pricingConfigSchema.parse(defaultConfig);

/** Checks a configuration someone typed or pasted, including the relations the schema alone cannot express. */
export function parsePricingConfig(input: unknown): { ok: true; value: PricingConfig } | { ok: false; error: string } {
  const r = pricingConfigSchema.safeParse(input);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, error: `${i.path.join(".") || "config"}: ${i.message}` };
  }
  const c = r.data;
  const asc = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]);
  if (!asc(c.shipping.bands.map((b) => b.maxKg))) return { ok: false, error: "shipping.bands must go up in weight (maxKg)." };
  const tiers = c.serviceCharge.marginalTiers;
  if (tiers.slice(0, -1).some((t) => t.upToGhs === null) || tiers[tiers.length - 1].upToGhs !== null) return { ok: false, error: "serviceCharge.marginalTiers: only the last tier may be open-ended (upToGhs null)." };
  if (!asc(tiers.slice(0, -1).map((t) => t.upToGhs ?? 0))) return { ok: false, error: "serviceCharge.marginalTiers must go up in amount." };
  if (c.serviceCharge.capGhs < c.serviceCharge.minGhs) return { ok: false, error: "serviceCharge.capGhs must not be below minGhs." };
  if (!asc(c.fx.volTiers.map((t) => t.maxMove3d))) return { ok: false, error: "fx.volTiers must go up in maxMove3d." };
  if (!("other_regions" in c.delivery)) return { ok: false, error: "delivery needs an other_regions entry." };
  if (!c.categories.some((k) => k.id === "unknown")) return { ok: false, error: "categories needs an unknown category." };
  if (new Set(c.categories.map((k) => k.id)).size !== c.categories.length) return { ok: false, error: "categories has a repeated id." };
  for (const z of Object.keys(c.delivery)) if (!(z in c.internalCosts.lastMileGhs)) return { ok: false, error: `internalCosts.lastMileGhs needs an entry for ${z}.` };
  return { ok: true, value: c };
}

// ------------------------------------------------------------------ helpers

const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const r4 = (x: number) => Math.round((x + Number.EPSILON) * 10000) / 10000;
const ceilStep = (x: number, step: number) => Math.ceil(x / step - 1e-9) * step;

const catMap = (cfg: PricingConfig) => new Map(cfg.categories.map((c) => [c.id, c]));

/** Customer FX rate. `mid` is the live mid-market GBP to GHS; `move3d` is the absolute 3-day move (0.02 is 2%). */
export function customerRate(mid: number, move3d = 0, cfg: PricingConfig = DEFAULT_PRICING_CONFIG): { rate: number; markup: number } {
  const tier = cfg.fx.volTiers.find((t) => Math.abs(move3d) <= t.maxMove3d) ?? cfg.fx.volTiers[cfg.fx.volTiers.length - 1];
  const markup = cfg.fx.baseMarkup + tier.add;
  const costRate = mid * (1 + cfg.fx.assumedConversionCost);
  const rate = Math.max(mid * (1 + markup), costRate * (1 + cfg.fx.minOverCost));
  return { rate: r4(rate), markup: r4(rate / mid - 1) };
}

/** Effective import tax multiplier on CIF for a duty band. */
export function effectiveTaxRate(duty: number, cfg: PricingConfig = DEFAULT_PRICING_CONFIG): number {
  return duty + cfg.tax.levyPctOfCif + cfg.tax.vatStackPct * (1 + duty);
}

export function serviceCharge(goodsGhs: number, cfg: PricingConfig = DEFAULT_PRICING_CONFIG): number {
  let remaining = goodsGhs;
  let prev = 0;
  let fee = 0;
  for (const t of cfg.serviceCharge.marginalTiers) {
    const top = t.upToGhs === null ? Infinity : t.upToGhs;
    const slice = Math.max(0, Math.min(remaining, top - prev));
    fee += slice * t.pct;
    remaining -= slice;
    prev = top;
    if (remaining <= 0) break;
  }
  return r2(Math.min(cfg.serviceCharge.capGhs, Math.max(cfg.serviceCharge.minGhs, fee)));
}

export function shippingPrice(billableKg: number, cfg: PricingConfig = DEFAULT_PRICING_CONFIG): number {
  for (const b of cfg.shipping.bands) if (billableKg <= b.maxKg + 1e-9) return b.ghs;
  const top = cfg.shipping.bands[cfg.shipping.bands.length - 1].ghs;
  return r2(Math.max(top, billableKg * cfg.shipping.perKgAbove10Ghs));
}

/** The delivery fee for a pricing zone key; a key the configuration does not know is priced as other_regions. */
export function deliveryFee(zone: string, kg: number, cfg: PricingConfig = DEFAULT_PRICING_CONFIG): number {
  const z = cfg.delivery[zone] ?? cfg.delivery.other_regions;
  if (typeof z === "number") return z;
  return r2(z.base + Math.max(0, kg - 2) * z.perKgOver2);
}

const lastMile = (zone: string, cfg: PricingConfig) => cfg.internalCosts.lastMileGhs[zone] ?? cfg.internalCosts.lastMileGhs.other_regions ?? 0;

// ------------------------------------------------------------------ the quote

export type QuoteLine = {
  sku: string;
  /** A category id from the configuration; anything else is priced as "unknown". */
  category: string;
  unitGbp: number;
  qty: number;
  weightKg: number;
  dimsCm?: [number, number, number];
  ukDeliveryGbp?: number;
};

export type QuoteCart = { zone: string; lines: QuoteLine[] };

/** Market context: mid-market GBP/GHS, the customs (Bank of Ghana) rate, and the absolute 3-day move. */
export type QuoteCtx = { midGbpGhs: number; customsGbpGhs: number; move3d?: number };

export type QuoteOptions = { ignoreMinOrder?: boolean; service?: "air" | "sea" };

export type CustomerView = {
  currency: "GHS";
  service: "express_air" | "economy_sea";
  estimatedDelivery: string;
  rateLockedForMinutes: number;
  items: { sku: string; qty: number; lineTotalGhs: number }[];
  itemsSubtotalGhs: number;
  deliveryAndImportChargesGhs: number;
  totalGhs: number;
  includes: string[];
  nothingToPayOnDelivery: true;
};

export type InternalView = {
  rate: number;
  fxMarkupPct: number;
  goodsGhs: number;
  ukDelGhs: number;
  serviceGhs: number;
  shippingGhs: number;
  insuranceGhs: number;
  deliveryGhs: number;
  taxChargedGhs: number;
  billableKg: number;
  perKgGhs: number;
  costs: Record<"goods" | "freight" | "clearance" | "insurance" | "lastMile" | "dutyActual" | "psp" | "provision" | "vatOnFees" | "supportAndReferral", number>;
  totalCostsGhs: number;
  contributionGhs: number;
  contributionPctOfTotal: number;
  flags: string[];
};

export type Quote = { customerView: CustomerView; internal: InternalView };

/**
 * Prices a cart. `cart.zone` is a pricing zone key (a key of `delivery` in the configuration).
 */
export function quote(cart: QuoteCart, ctx: QuoteCtx, opts: QuoteOptions = {}, cfg: PricingConfig = DEFAULT_PRICING_CONFIG): Quote {
  const flags: string[] = [];
  const cats = catMap(cfg);
  const unknown = cats.get("unknown")!;
  const { rate, markup } = customerRate(ctx.midGbpGhs, ctx.move3d ?? 0, cfg);

  let goodsGbp = 0;
  let ukDelGbp = 0;
  let rawKg = 0;
  const lines = cart.lines.map((l) => {
    const known = cats.get(l.category);
    const cat = known ?? unknown;
    if (!known) flags.push("unknown_category:" + l.sku);
    for (const f of cat.flags) if (f === "manual_review" || f === "fda_rules" || f === "high_value_review") flags.push(f + ":" + l.sku);
    const vol = l.dimsCm ? (l.dimsCm[0] * l.dimsCm[1] * l.dimsCm[2]) / cfg.shipping.volumetricDivisor : 0;
    const unitKg = Math.max(l.weightKg, vol);
    if (unitKg > cfg.shipping.maxKgPerParcel) flags.push("over_weight_limit:" + l.sku);
    const g = l.unitGbp * l.qty;
    goodsGbp += g;
    ukDelGbp += l.ukDeliveryGbp ?? 0;
    rawKg += unitKg * l.qty;
    return { ...l, cat, goodsGbp: g, kg: unitKg * l.qty, taxPlanningGhs: 0 };
  });

  const goodsGhs = r2(goodsGbp * rate);
  const ukDelGhs = r2(ukDelGbp * rate);
  if (!opts.ignoreMinOrder && goodsGhs < cfg.minOrderGhs) flags.push("below_minimum_order");

  const billableKg = Math.max(cfg.shipping.stepKg, ceilStep(rawKg, cfg.shipping.stepKg));
  const wantSea = opts.service === "sea";
  const sea = cfg.shipping.sea;
  const useSea = wantSea && sea.enabled && billableKg >= sea.minBillableKg;
  if (wantSea && !useSea) flags.push("sea_not_available_using_air");
  const shippingGhs = useSea ? r2(Math.max(sea.minGhs, billableKg * sea.ratePerKgGhs)) : shippingPrice(billableKg, cfg);
  const perKg = r2(shippingGhs / billableKg);
  const service = useSea ? "economy_sea" : "express_air";

  const insuranceGhs = r2(Math.max(cfg.insurance.minGhs, goodsGhs * cfg.insurance.pct));
  const serviceGhs = serviceCharge(goodsGhs, cfg);
  const deliveryGhs = deliveryFee(cart.zone, billableKg, cfg);

  // Prepaid duty and taxes: the base is CIF (goods + UK delivery + declared freight + insurance) at the customs (BoG) rate.
  const freightGbp = billableKg * (useSea ? sea.declaredFreightGbpPerKg : cfg.shipping.declaredFreightGbpPerKg);
  const insuranceGbp = goodsGbp * cfg.insurance.costPct;
  let taxPlanningGhs = 0;
  for (const l of lines) {
    const share = goodsGbp > 0 ? l.goodsGbp / goodsGbp : 0;
    const kgShare = rawKg > 0 ? l.kg / rawKg : 0;
    const cifGbp = l.goodsGbp + ukDelGbp * share + freightGbp * kgShare + insuranceGbp * share;
    l.taxPlanningGhs = cifGbp * ctx.customsGbpGhs * effectiveTaxRate(l.cat.duty, cfg);
    taxPlanningGhs += l.taxPlanningGhs;
  }
  const taxChargedGhs = r2(taxPlanningGhs * (1 + cfg.tax.bufferPct));

  let serviceFinal = serviceGhs;
  let totalGhs = r2(goodsGhs + ukDelGhs + serviceFinal + shippingGhs + insuranceGhs + deliveryGhs + taxChargedGhs);

  // ---- Internal economics (computed first so the contribution floor can adjust the service charge). ----
  const ic = cfg.internalCosts;
  const costRate = ctx.midGbpGhs * (1 + cfg.fx.assumedConversionCost);
  const goodsCost = (goodsGbp + ukDelGbp) * costRate;
  const freightCost = billableKg * (useSea ? ic.seaForwarderGbpPerKg : ic.forwarderGbpPerKg) * costRate;
  const insuranceCost = goodsGbp * cfg.insurance.costPct * ctx.midGbpGhs;
  const lastMileCost = lastMile(cart.zone, cfg);
  const dutyActual = taxPlanningGhs * cfg.tax.actualVsPlanning;
  const provision = goodsGhs * ic.lossProvisionPct;
  const variableOps = ic.supportGhsPerOrder + ic.marketingGbpPerOrder * ctx.midGbpGhs;
  const vatF = ic.vatOnFees ? ic.vatInclusiveFactor : 0;
  const compute = (svc: number, total: number) => {
    const psp = total * ic.pspPct;
    const vat = (svc + deliveryGhs) * vatF;
    const costs = goodsCost + freightCost + ic.clearanceGhsPerOrder + insuranceCost + lastMileCost + dutyActual + psp + provision + vat + variableOps;
    return { psp, vat, costs, contribution: total - costs };
  };
  let econ = compute(serviceFinal, totalGhs);
  if (econ.contribution < cfg.contributionFloorGhs) {
    // Guarantee every order clears the floor: top up the service charge (grossed up for the payment fee and VAT on fees).
    const floorTopUp = (cfg.contributionFloorGhs - econ.contribution) / (1 - ic.pspPct - vatF);
    serviceFinal = r2(serviceFinal + floorTopUp);
    totalGhs = r2(totalGhs + floorTopUp);
    econ = compute(serviceFinal, totalGhs);
    flags.push("floor_topup:" + r2(floorTopUp));
  }
  const contributionGhs = r2(econ.contribution);

  // ---- Customer view: item prices carry the service charge; everything else is one all-in line. ----
  const deliveryAndImport = r2(ukDelGhs + shippingGhs + insuranceGhs + deliveryGhs + taxChargedGhs);
  let allocated = 0;
  const itemLines = lines.map((l, i) => {
    const lineGhs = l.goodsGbp * rate;
    let shown = r2(lineGhs + serviceFinal * (goodsGbp > 0 ? l.goodsGbp / goodsGbp : 0));
    if (i === lines.length - 1) shown = r2(goodsGhs + serviceFinal - allocated);
    allocated += shown;
    return { sku: l.sku, qty: l.qty, lineTotalGhs: shown };
  });
  const customerView: CustomerView = {
    currency: "GHS",
    service,
    estimatedDelivery: useSea ? sea.transit : cfg.shipping.airTransit,
    rateLockedForMinutes: cfg.fx.quoteTtlMinutes,
    items: itemLines,
    itemsSubtotalGhs: r2(goodsGhs + serviceFinal),
    deliveryAndImportChargesGhs: deliveryAndImport,
    totalGhs,
    includes: ["Cargo insurance", "Duties and taxes", "Door delivery in " + cart.zone.replace(/_/g, " ")],
    nothingToPayOnDelivery: true,
  };

  const internal: InternalView = {
    rate,
    fxMarkupPct: r4(markup),
    goodsGhs, ukDelGhs, serviceGhs: serviceFinal, shippingGhs, insuranceGhs, deliveryGhs, taxChargedGhs,
    billableKg, perKgGhs: perKg,
    costs: {
      goods: r2(goodsCost), freight: r2(freightCost), clearance: ic.clearanceGhsPerOrder, insurance: r2(insuranceCost),
      lastMile: lastMileCost, dutyActual: r2(dutyActual), psp: r2(econ.psp), provision: r2(provision), vatOnFees: r2(econ.vat), supportAndReferral: r2(variableOps),
    },
    totalCostsGhs: r2(econ.costs),
    contributionGhs,
    contributionPctOfTotal: totalGhs > 0 ? r4(contributionGhs / totalGhs) : 0,
    flags,
  };
  return { customerView, internal };
}

/** Product-page estimate: the all-in landed price of one unit, with no minimum-order check. */
export function estimateLanded(line: Omit<QuoteLine, "qty">, zone: string, ctx: QuoteCtx, cfg: PricingConfig = DEFAULT_PRICING_CONFIG): number {
  return quote({ zone, lines: [{ ...line, qty: 1 }] }, ctx, { ignoreMinOrder: true }, cfg).customerView.totalGhs;
}
