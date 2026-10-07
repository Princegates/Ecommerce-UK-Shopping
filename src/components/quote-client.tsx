"use client";

import { priceOrder, type FxConfig, type PriceableItem, type PriceBreakdown, type RateCard, type ServiceFeeRule } from "@/lib/pricing";
import { ghs } from "@/lib/money";

export type QuoteConfig = {
  fx: FxConfig;
  serviceFee: ServiceFeeRule;
  methods: { code: string; name: string; eta: string; rateCard: RateCard }[];
  zones: { id: number; name: string; areas: string; feeMinor: number; eta: string }[];
};

/** Same pricing code the server uses, so the figure on screen is the figure charged. */
export function computeQuote(
  items: PriceableItem[],
  cfg: QuoteConfig,
  zoneId: number,
  code: string,
): PriceBreakdown | null {
  const method = cfg.methods.find((m) => m.code === code);
  const zone = cfg.zones.find((z) => z.id === zoneId);
  if (!method || !zone) return null;
  return priceOrder({
    items,
    fx: cfg.fx,
    serviceFee: cfg.serviceFee,
    rateCard: method.rateCard,
    deliveryFeeMinor: zone.feeMinor,
  });
}

export function DeliverySelectors({
  cfg,
  zoneId,
  code,
  onZone,
  onCode,
  idPrefix,
}: {
  cfg: QuoteConfig;
  zoneId: number;
  code: string;
  onZone: (id: number) => void;
  onCode: (code: string) => void;
  idPrefix: string;
}) {
  const zone = cfg.zones.find((z) => z.id === zoneId);
  return (
    <div className="grid gap-4">
      <div className="field">
        <label className="label" htmlFor={`${idPrefix}-zone`}>Delivery area in Ghana</label>
        <select
          id={`${idPrefix}-zone`}
          name="zone"
          className="select"
          value={zoneId}
          onChange={(e) => onZone(Number(e.target.value))}
        >
          {cfg.zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} · {ghs(z.feeMinor)}
            </option>
          ))}
        </select>
        {zone && <p className="hint">{zone.areas}. Usually {zone.eta} after it reaches Accra.</p>}
      </div>

      <fieldset className="field">
        <legend className="mb-1 text-sm font-bold">Shipping to Ghana</legend>
        <div className="grid gap-2">
          {cfg.methods.map((m) => (
            <label key={m.code} className={`box flex cursor-pointer items-start gap-3 p-3 ${m.code === code ? "!border-blue !bg-blue-soft ring-1 ring-blue" : ""}`}>
              <input
                type="radio"
                name="ship"
                value={m.code}
                checked={m.code === code}
                onChange={() => onCode(m.code)}
                className="mt-1 h-4 w-4 accent-[var(--blue)]"
              />
              <span>
                <span className="block font-semibold">{m.name}</span>
                <span className="hint">{m.eta}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
