"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ghs } from "@/lib/money";

const KEY = "recently-viewed";

type Item = { id: number; slug: string; name: string; shop: string; accent: string; imageUrl: string | null; priceMinor: number; wasMinor: number | null };

function read(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)).slice(0, 12) : [];
  } catch {
    return [];
  }
}

/** Remember this item in the browser, on this device only. */
export function TrackView({ productId }: { productId: number }) {
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([productId, ...read().filter((n) => n !== productId)].slice(0, 12)));
    } catch { /* storage may be blocked */ }
  }, [productId]);
  return null;
}

/** The items this visitor looked at lately, kept in their own browser. */
export default function RecentlyViewed({ excludeId, title = "Recently viewed" }: { excludeId?: number; title?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const ids = read().filter((n) => n !== excludeId);
    if (ids.length === 0) return;
    const ctl = new AbortController();
    fetch(`/api/products?ids=${ids.join(",")}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((v: Item[]) => setItems(Array.isArray(v) ? v : []))
      .catch(() => {});
    return () => ctl.abort();
  }, [excludeId]);

  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-14" aria-labelledby="rv-h">
      <h2 id="rv-h" className="text-3xl">{title}</h2>
      <ul className="rail mt-5" aria-label={title}>
        {items.map((p) => (
          <li key={p.id} className="w-40 sm:w-48">
            <Link href={`/products/${p.slug}`} className="box block hover:-translate-y-0.5">
              <div className="grid aspect-[4/3] place-items-center border-b-2 border-ink text-3xl font-bold text-white" style={{ background: p.accent }} aria-hidden="true">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : p.name.slice(0, 2)}
              </div>
              <div className="grid gap-0.5 p-2.5">
                <span className="line-clamp-2 text-sm font-semibold">{p.name}</span>
                <span className="num display">{ghs(p.priceMinor)} {p.wasMinor && <span className="was ml-1 text-xs">{ghs(p.wasMinor)}</span>}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
