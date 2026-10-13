"use client";

import { quoteKey, type CustomerBreakdown, type QuoteConfig } from "@/lib/quote-config";

export type { QuoteConfig };

/** The customer amounts the server worked out for this delivery area and shipping method. */
export function pickQuote(cfg: Pick<QuoteConfig, "quotes">, zoneId: number, code: string): CustomerBreakdown | null {
  return cfg.quotes[quoteKey(zoneId, code)] ?? null;
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
              {z.name}
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

/** Says how long the shown price is held, or that new prices are on hold while the exchange rate is checked. */
export function RateHold({ cfg }: { cfg: QuoteConfig }) {
  if (cfg.frozen) {
    return (
      <p className="error-text" role="alert">
        We are checking today&rsquo;s exchange rate and cannot confirm prices for a short while. Please check back soon.
      </p>
    );
  }
  if (!cfg.lockedUntil) return null;
  const at = new Date(cfg.lockedUntil).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return <p className="text-xs text-ink-soft">Your price is held until {at} (Ghana time).</p>;
}
