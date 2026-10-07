"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { addToCartAction, type AddState } from "@/app/actions/cart";
import Breakdown from "@/components/Breakdown";
import { computeQuote, DeliverySelectors, type QuoteConfig } from "@/components/quote-client";
import { gbp, ghs } from "@/lib/money";
import { gbpToGhsMinor } from "@/lib/pricing";

type Props = {
  product: {
    id: number;
    name: string;
    priceMinor: number;
    weightGrams: number;
    options: { name: string; values: string[] }[];
  };
  cfg: QuoteConfig;
  maxQty: number;
};

export default function BuyBox({ product, cfg, maxQty }: Props) {
  const [state, action, pending] = useActionState<AddState, FormData>(addToCartAction, {});
  const [qty, setQty] = useState(1);
  const [zoneId, setZoneId] = useState(cfg.zones[0]?.id ?? 0);
  const [code, setCode] = useState(cfg.methods[0]?.code ?? "");

  const quote = useMemo(
    () =>
      computeQuote(
        [{ id: String(product.id), unitPriceMinor: product.priceMinor, quantity: qty, weightGrams: product.weightGrams }],
        cfg,
        zoneId,
        code,
      ),
    [product, cfg, qty, zoneId, code],
  );
  const unitGhs = gbpToGhsMinor(product.priceMinor, cfg.fx);

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="quantity" value={qty} />

      <div>
        <p className="num display text-5xl">{ghs(unitGhs)}</p>
        <p className="label mt-1 num">{gbp(product.priceMinor)} in the UK shop · item price only</p>
      </div>

      {product.options.map((group) => (
        <fieldset key={group.name}>
          <legend className="label mb-2 text-ink">{group.name}</legend>
          <div className="flex flex-wrap gap-2">
            {group.values.map((v, i) => (
              <label key={v} className="pill">
                <input type="radio" name={`opt:${group.name}`} value={v} required defaultChecked={group.values.length === 1 && i === 0} />
                <span>{v}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div>
        <p className="label mb-2 text-ink">Quantity</p>
        <div className="inline-flex border-2 border-ink bg-paper-3">
          <button type="button" className="h-11 w-11 text-xl font-bold hover:bg-gold" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            −
          </button>
          <output className="num grid h-11 w-14 place-items-center border-x-2 border-ink font-semibold" aria-live="polite">
            {qty}
          </output>
          <button type="button" className="h-11 w-11 text-xl font-bold hover:bg-gold" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="Increase quantity">
            +
          </button>
        </div>
      </div>

      <section aria-labelledby="cost-heading" className="receipt p-5">
        <h2 id="cost-heading" className="!text-xl">What it costs to your door</h2>
        <div className="mt-4 font-sans">
          <DeliverySelectors cfg={cfg} zoneId={zoneId} code={code} onZone={setZoneId} onCode={setCode} idPrefix="pdp" />
        </div>
        <hr />
        {quote ? <Breakdown b={quote} /> : <p>Delivery options are not available right now.</p>}
        <p className="mt-3 text-xs text-ink-soft">Import duty charged by customs, if any, is not included.</p>
      </section>

      <div className="grid gap-3">
        <button className="btn btn-primary w-full !text-lg" disabled={pending}>
          {pending ? "Adding…" : "Add to cart"}
        </button>
        <div aria-live="polite">
          {state.error && <p className="error-text">{state.error}</p>}
          {state.added && (
            <p className="box flex flex-wrap items-center justify-between gap-3 bg-gold/40 p-3 font-semibold">
              Added to your cart.
              <Link href="/cart" className="btn btn-small btn-primary">View cart</Link>
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
