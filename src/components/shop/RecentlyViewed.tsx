"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProductArt from "@/components/ProductArt";
import { CONSENT_EVENT, optionalAllowed } from "@/lib/consent";
import { gbp, ghs } from "@/lib/money";

const KEY = "recently-viewed";

type Item = { id: number; slug: string; name: string; shop: string; accent: string; imageUrl: string | null; priceMinor: number; gbpMinor: number; category: string; };

function read(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)).slice(0, 12) : [];
  } catch {
    return [];
  }
}

/** Forget everything remembered here. Called when the visitor chooses "Essential only". */
function forget() {
  try { localStorage.removeItem(KEY); } catch { /* storage may be blocked */ }
}

/** Remember this item in the browser, on this device only, and only if the visitor accepted optional cookies. */
export function TrackView({ productId }: { productId: number }) {
  useEffect(() => {
    const save = () => {
      if (!optionalAllowed()) return forget();
      try {
        localStorage.setItem(KEY, JSON.stringify([productId, ...read().filter((n) => n !== productId)].slice(0, 12)));
      } catch { /* storage may be blocked */ }
    };
    save();
    window.addEventListener(CONSENT_EVENT, save);
    return () => window.removeEventListener(CONSENT_EVENT, save);
  }, [productId]);
  return null;
}

/** The items this visitor looked at lately, kept in their own browser. */
export default function RecentlyViewed({ excludeId, title = "Recently viewed" }: { excludeId?: number; title?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const sync = () => setAllowed(optionalAllowed());
    const t = setTimeout(sync, 0);
    window.addEventListener(CONSENT_EVENT, sync);
    return () => { clearTimeout(t); window.removeEventListener(CONSENT_EVENT, sync); };
  }, []);
  useEffect(() => {
    if (!allowed) { forget(); const t = setTimeout(() => setItems([]), 0); return () => clearTimeout(t); }
    const ids = read().filter((n) => n !== excludeId);
    if (ids.length === 0) return;
    const ctl = new AbortController();
    fetch(`/api/products?ids=${ids.join(",")}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((v: Item[]) => setItems(Array.isArray(v) ? v : []))
      .catch(() => {});
    return () => ctl.abort();
  }, [excludeId, allowed]);

  if (!allowed || items.length === 0) return null;
  return (
    <section className="mx-auto mt-4 max-w-[90rem] px-3 md:px-4" aria-labelledby="rv-h">
      <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,17,17,0.12)] md:p-5">
        <h2 id="rv-h" className="text-xl font-bold">{title}</h2>
        <ul className="rail mt-3" aria-label={title}>
          {items.map((p) => (
            <li key={p.id} className="w-36 sm:w-44">
              <Link href={`/products/${p.slug}`} className="lift block overflow-hidden rounded-lg border border-line">
                <ProductArt name={p.name} accent={p.accent} imageUrl={p.imageUrl} category={p.category} />
                <div className="grid gap-0.5 p-2.5">
                  <span className="line-clamp-2 text-sm">{p.name}</span>
                  <span className="num text-base font-medium">{ghs(p.priceMinor)}</span>
                  <span className="num text-xs text-ink-soft">{gbp(p.gbpMinor)} UK price</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
