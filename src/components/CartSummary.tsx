"use client";

import { useMemo, useState } from "react";
import { goToCheckoutAction } from "@/app/actions/cart";
import Breakdown from "@/components/Breakdown";
import { computeQuote, DeliverySelectors, type QuoteConfig } from "@/components/quote-client";
import { gbp } from "@/lib/money";
import type { PriceableItem } from "@/lib/pricing";

export default function CartSummary({
  items,
  cfg,
  minOrderGbpMinor,
}: {
  items: PriceableItem[];
  cfg: QuoteConfig;
  minOrderGbpMinor: number;
}) {
  const [zoneId, setZoneId] = useState(cfg.zones[0]?.id ?? 0);
  const [code, setCode] = useState(cfg.methods[0]?.code ?? "");
  const quote = useMemo(() => computeQuote(items, cfg, zoneId, code), [items, cfg, zoneId, code]);
  const belowMin = quote ? quote.itemsGbpMinor < minOrderGbpMinor : false;

  return (
    <form action={goToCheckoutAction} className="receipt grid gap-4 p-5 lg:sticky lg:top-44">
      <h2 className="!text-2xl">Order summary</h2>
      <div className="font-sans">
        <DeliverySelectors cfg={cfg} zoneId={zoneId} code={code} onZone={setZoneId} onCode={setCode} idPrefix="cart" />
      </div>
      <hr className="!my-0" />
      {quote ? <Breakdown b={quote} /> : <p>Delivery options are not available right now.</p>}
      {belowMin && (
        <p className="error-text" role="alert">
          The minimum order is {gbp(minOrderGbpMinor)} of items. Add a little more to continue.
        </p>
      )}
      <button className="btn btn-primary w-full !text-lg" disabled={!quote || belowMin}>
        Continue to checkout
      </button>
      <p className="text-xs text-ink-soft">
        Import duty charged by customs, if any, is not included. You will confirm your address on the next step.
      </p>
    </form>
  );
}
