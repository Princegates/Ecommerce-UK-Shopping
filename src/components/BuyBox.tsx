"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { addToCartAction, type AddState } from "@/app/actions/cart";
import Breakdown from "@/components/Breakdown";
import { ghsToGbpMinor } from "@/lib/pricing";
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
  const mainButton = useRef<HTMLButtonElement>(null);
  const [mainVisible, setMainVisible] = useState(true);
  useEffect(() => {
    const el = mainButton.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setMainVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (state.added) window.dispatchEvent(new Event("cart:added"));
  }, [state.added, state.nonce]);

  return (
    <form action={action} className="grid gap-5 rounded-lg border border-line bg-white p-4 shadow-[0_2px_5px_rgba(15,17,17,0.15)]">
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="quantity" value={qty} />

      {product.options.map((group) => (
        <fieldset key={group.name}>
          <legend className="mb-2 text-sm font-bold">{group.name}</legend>
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
        <p className="mb-2 text-sm font-bold">Quantity</p>
        <div className="inline-flex overflow-hidden rounded-full border border-[#888c8c] bg-paper-2">
          <button type="button" className="h-9 w-10 text-lg font-bold hover:bg-blue-soft" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            −
          </button>
          <output className="num grid h-9 w-12 place-items-center border-x border-[#888c8c] bg-white font-semibold" aria-live="polite">
            {qty}
          </output>
          <button type="button" className="h-9 w-10 text-lg font-bold hover:bg-blue-soft" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="Increase quantity">
            +
          </button>
        </div>
      </div>

      <section aria-labelledby="cost-heading" className="receipt !border-0 !bg-paper-2 !shadow-none p-4 text-sm">
        <h2 id="cost-heading" className="!text-xl">What it costs to your door</h2>
        <div className="mt-4 font-sans">
          <DeliverySelectors cfg={cfg} zoneId={zoneId} code={code} onZone={setZoneId} onCode={setCode} idPrefix="pdp" />
        </div>
        <hr />
        {quote ? <Breakdown b={quote} approxGbpMinor={ghsToGbpMinor(quote.totalMinor, cfg.fx)} /> : <p>Delivery options are not available right now.</p>}
        <p className="mt-3 text-xs text-ink-soft">Import duty charged by customs, if any, is not included.</p>
      </section>

      <div className="grid gap-3">
        <button ref={mainButton} className="btn btn-gold w-full !min-h-11 !text-base" disabled={pending}>
          {pending ? "Adding…" : "Add to cart"}
        </button>
        <div aria-live="polite">
          {state.error && <p className="error-text">{state.error}</p>}
          {state.added && (
            <p className="pop flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green bg-green/10 p-3 font-semibold text-green">
              Added to your cart.
              <Link href="/cart" className="btn btn-small btn-primary">View cart</Link>
            </p>
          )}
        </div>
      </div>
      {!mainVisible && (
        <div className="fixed inset-x-0 bottom-[3.6rem] z-40 flex items-center justify-between gap-3 border-t border-line bg-white p-3 shadow-[0_-2px_8px_rgba(15,17,17,0.15)] md:hidden">
          <div>
            <p className="num text-xl font-medium">{ghs(unitGhs)}</p>
            {quote && <p className="num text-xs text-ink-soft">{gbp(product.priceMinor)} · {ghs(quote.totalMinor)} to your door</p>}
          </div>
          <button className="btn btn-gold" disabled={pending}>{pending ? "Adding…" : "Add to cart"}</button>
        </div>
      )}
    </form>
  );
}
