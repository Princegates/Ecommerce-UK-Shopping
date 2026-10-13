"use client";

import { useState } from "react";
import { goToCheckoutAction } from "@/app/actions/cart";
import Breakdown, { BREAKDOWN_NOTE } from "@/components/Breakdown";
import { DeliverySelectors, pickQuote, RateHold, type QuoteConfig } from "@/components/quote-client";
import { ghs } from "@/lib/money";
import { ghsToGbpMinor } from "@/lib/pricing";

export default function CartSummary({ cfg }: { cfg: QuoteConfig }) {
  const [zoneId, setZoneId] = useState(cfg.zones[0]?.id ?? 0);
  const [code, setCode] = useState(cfg.methods[0]?.code ?? "");
  const quote = pickQuote(cfg, zoneId, code);
  const belowMin = quote?.belowMinimumOrder ?? false;

  return (
    <form action={goToCheckoutAction} className="receipt grid content-start gap-4 p-5 lg:sticky lg:top-36 lg:self-start">
      <h2 className="text-lg font-bold">Order summary</h2>
      <div className="font-sans">
        <DeliverySelectors cfg={cfg} zoneId={zoneId} code={code} onZone={setZoneId} onCode={setCode} idPrefix="cart" />
      </div>
      <hr className="!my-0" />
      {quote ? <Breakdown b={quote} approxGbpMinor={ghsToGbpMinor(quote.totalMinor, cfg.fx)} /> : <p>Delivery options are not available right now.</p>}
      <RateHold cfg={cfg} />
      {belowMin && (
        <p className="error-text" role="alert">
          The minimum order is {ghs(cfg.minOrderMinor)} of items. Add a little more to continue.
        </p>
      )}
      {quote?.overWeight && <p className="error-text" role="alert">One of the items is too heavy for us to ship. Please contact us.</p>}
      <button className="btn btn-gold w-full !min-h-11 !text-base" disabled={!quote || belowMin || quote.overWeight || cfg.frozen}>
        Proceed to checkout
      </button>
      <p className="text-xs text-ink-soft">{BREAKDOWN_NOTE} You will confirm your address on the next step.</p>
    </form>
  );
}
