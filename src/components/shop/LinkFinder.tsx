"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { quickLinkAction } from "@/app/actions/request";
import { gbp, ghs } from "@/lib/money";

type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "onsite"; slug: string; name: string }
  | { kind: "found"; name: string; priceMinor: number; priceGhsMinor: number; host: string; itemTypes: string[] }
  | { kind: "none"; reason: string }
  | { kind: "invalid" };

/**
 * Paste a UK product link: we say if it is already listed, read its name and price when the shop allows it, or take a
 * request for it. Used in the header drop-down and, larger, on the home page.
 */
export default function LinkFinder({ big = false, onDark = false }: { big?: boolean; onDark?: boolean }) {
  const [url, setUrl] = useState("");
  const [res, setRes] = useState<Result>({ kind: "idle" });
  const seq = useRef(0);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    const u = url.trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(u)) { setRes({ kind: "invalid" }); return; }
    const n = ++seq.current;
    setRes({ kind: "loading" });
    try {
      const r = await fetch(`/api/link-preview?url=${encodeURIComponent(u)}`);
      const j = await r.json();
      if (n !== seq.current) return;
      if (j.ok && j.onSite) setRes({ kind: "onsite", slug: j.onSite.slug, name: j.onSite.name });
      else if (j.ok) setRes({ kind: "found", name: j.name, priceMinor: j.priceMinor, priceGhsMinor: j.priceGhsMinor ?? 0, host: j.host, itemTypes: Array.isArray(j.itemTypes) ? j.itemTypes : [] });
      else setRes({ kind: "none", reason: j.reason ?? "error" });
    } catch {
      if (n === seq.current) setRes({ kind: "none", reason: "error" });
    }
  }

  const qs = (extra: Record<string, string> = {}) => new URLSearchParams({ url: url.trim(), ...extra }).toString();

  return (
    <div className="grid gap-3">
      <form onSubmit={find} className="grid gap-3">
      {!big && (
        <div>
          <p className="text-base font-bold">Add any UK item by link</p>
          <p className="text-sm text-ink-soft">Paste the product link. We find it, or take your request and quote the full cost in cedis.</p>
        </div>
      )}
      <div className={`flex gap-2 ${big ? "flex-col sm:flex-row" : ""}`}>
        <label htmlFor={big ? "link-big-url" : "link-add-url"} className="sr-only">Product link</label>
        <input
          id={big ? "link-big-url" : "link-add-url"} value={url} onChange={(e) => setUrl(e.target.value)}
          className={`input min-w-0 flex-1 ${big ? "!min-h-14 !rounded-xl !border-2 !border-ink !px-4 !text-base text-ink" : "!min-h-10"}`}
          placeholder={big ? "Paste a product link here (https://…)" : "https://www.shop.co.uk/product/…"} inputMode="url" autoComplete="off"
        />
        <button className={`btn btn-gold shrink-0 ${big ? "!min-h-14 !px-8 !text-base" : "!min-h-10"}`} disabled={res.kind === "loading"}>
          {res.kind === "loading" ? "Looking…" : big ? "Get my price in cedis" : "Find"}
        </button>
      </div>
      </form>
      <div aria-live="polite" className={`text-sm ${onDark ? "text-ink" : ""}`}>
        {res.kind === "invalid" && <p className={onDark ? "rounded-lg bg-white p-2 font-semibold text-red" : "error-text"}>Paste a full link starting with https://</p>}
        {res.kind === "onsite" && (
          <div className="pop grid gap-2 rounded-xl border border-green bg-white p-3">
            <p className="font-bold text-green">We already list this.</p>
            <p>{res.name}</p>
            <Link href={`/products/${res.slug}`} className="btn btn-small btn-primary w-fit">View item</Link>
          </div>
        )}
        {res.kind === "found" && (
          <div className="pop grid gap-3 rounded-xl border-2 border-green bg-white p-3">
            <div>
              <p className="font-bold text-green">We found it</p>
              <p className="font-semibold">{res.name}</p>
              <p className="num mt-1">
                <span className="text-lg font-bold">{gbp(res.priceMinor)}</span> on {res.host}
                {res.priceGhsMinor > 0 && <span className="ml-2 font-bold text-red">≈ {ghs(res.priceGhsMinor)}</span>}
              </p>
              <p className="text-xs text-ink-soft">Item price only. The next step shows your full cost with shipping and delivery to Ghana.</p>
            </div>
            <form action={quickLinkAction} className="grid gap-2">
              <input type="hidden" name="url" value={url.trim()} />
              <input type="hidden" name="title" value={res.name} />
              <div className="grid gap-2 sm:grid-cols-[5rem_1fr]">
                <div className="field"><label className="label" htmlFor={`${big ? "b" : "h"}-qty`}>Quantity</label><input id={`${big ? "b" : "h"}-qty`} name="quantity" type="number" min={1} max={20} defaultValue={1} className="input !min-h-10" /></div>
                {res.itemTypes.length > 0 && (
                  <div className="field"><label className="label" htmlFor={`${big ? "b" : "h"}-type`}>Kind of item</label>
                    <select id={`${big ? "b" : "h"}-type`} name="itemType" className="select !min-h-10" defaultValue={res.itemTypes[res.itemTypes.length - 1]}>
                      {res.itemTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="field"><label className="label" htmlFor={`${big ? "b" : "h"}-det`}>Size, colour or other details</label><input id={`${big ? "b" : "h"}-det`} name="details" className="input !min-h-10" placeholder="e.g. UK 9, black" maxLength={300} /></div>
              <button className="btn btn-gold w-full !min-h-12 !text-base">Get my full price and pay</button>
            </form>
          </div>
        )}
        {res.kind === "none" && (
          <div className="grid gap-2 rounded-xl border border-line bg-white p-3">
            <p>We could not read that page automatically{res.reason === "robots" || res.reason === "blocked" ? " (the shop does not allow it)" : ""}. You can still request it and we will check it for you.</p>
            <Link href={`/request?${qs()}`} className="btn btn-small btn-gold w-fit">Request it anyway</Link>
          </div>
        )}
      </div>
    </div>
  );
}
