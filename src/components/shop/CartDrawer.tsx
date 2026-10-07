"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gbp, ghs } from "@/lib/money";

type Summary = {
  count: number;
  itemsGbpMinor: number;
  itemsGhsMinor: number;
  minOrderGbpMinor: number;
  items: { id: number; slug: string; name: string; shop: string; accent: string; imageUrl: string | null; quantity: number; options: string; lineGhsMinor: number }[];
};

/** Slides in after something is added to the cart, with a way to carry on shopping or check out. */
export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/cart/summary", { cache: "no-store" });
      if (!res.ok) throw new Error("bad");
      setData((await res.json()) as Summary);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const show = () => {
      opener.current = document.activeElement as HTMLElement | null;
      setOpen(true);
      void load();
    };
    window.addEventListener("cart:added", show);
    window.addEventListener("cart:open", show);
    return () => { window.removeEventListener("cart:added", show); window.removeEventListener("cart:open", show); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; opener.current?.focus?.(); };
  }, [open]);

  if (!open) return null;
  const short = data ? Math.max(0, data.minOrderGbpMinor - data.itemsGbpMinor) : 0;
  const progress = data && data.minOrderGbpMinor > 0 ? Math.min(100, (data.itemsGbpMinor / data.minOrderGbpMinor) * 100) : 100;

  return (
    <>
      <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-h">
        <header className="flex items-center justify-between gap-3 border-b border-line p-4">
          <h2 id="drawer-h" className="text-2xl">Your cart{data ? ` (${data.count})` : ""}</h2>
          <button ref={closeRef} className="icon-btn" onClick={() => setOpen(false)} aria-label="Close cart">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {failed && <p role="alert" className="error-text">We could not load your cart. <Link href="/cart" className="link">Open the cart page</Link></p>}
          {!data && !failed && <p className="text-ink-soft">Loading…</p>}
          {data && data.items.length === 0 && <p>Your cart is empty.</p>}
          {data && data.items.length > 0 && (
            <>
              {data.minOrderGbpMinor > 0 && (
                <div className="box mb-4 p-3 text-sm" role="status">
                  {short > 0 ? (
                    <p>Add <strong>{gbp(short)}</strong> more of items to reach the {gbp(data.minOrderGbpMinor)} minimum order.</p>
                  ) : (
                    <p className="font-semibold text-green">You have reached the minimum order. You are good to check out.</p>
                  )}
                  <div className="mt-2 h-2.5 border border-line bg-paper-2" aria-hidden="true"><div className="h-full bg-green" style={{ width: `${progress}%` }} /></div>
                </div>
              )}
              <ul className="grid gap-3">
                {data.items.map((i) => (
                  <li key={i.id} className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 border-b border-line pb-3">
                    <div className="grid h-16 w-16 place-items-center border border-line text-xl font-bold text-white" style={{ background: i.accent }} aria-hidden="true">
                      {i.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : i.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <Link href={`/products/${i.slug}`} onClick={() => setOpen(false)} className="line-clamp-2 text-sm font-semibold hover:underline">{i.name}</Link>
                      <p className="label">{i.shop}{i.options ? ` · ${i.options}` : ""}</p>
                      <p className="text-xs text-ink-soft">Qty {i.quantity}</p>
                    </div>
                    <p className="num text-sm font-semibold">{ghs(i.lineGhsMinor)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {data && data.items.length > 0 && (
          <footer className="grid gap-3 border-t border-line bg-paper-3 p-4">
            <p className="flex items-baseline justify-between"><span className="font-semibold">Items subtotal</span><span className="num display text-2xl">{ghs(data.itemsGhsMinor)}</span></p>
            <p className="hint">Service charge, shipping and delivery are added at the next step.</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/cart" className="btn" onClick={() => setOpen(false)}>View cart</Link>
              <Link href="/checkout" className="btn btn-primary" onClick={() => setOpen(false)}>Checkout</Link>
            </div>
            <button className="link text-sm" onClick={() => setOpen(false)}>Continue shopping</button>
          </footer>
        )}
      </aside>
    </>
  );
}
