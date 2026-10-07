"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { gbp } from "@/lib/money";

type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "onsite"; slug: string; name: string }
  | { kind: "found"; name: string; priceMinor: number; host: string }
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
      else if (j.ok) setRes({ kind: "found", name: j.name, priceMinor: j.priceMinor, host: j.host });
      else setRes({ kind: "none", reason: j.reason ?? "error" });
    } catch {
      if (n === seq.current) setRes({ kind: "none", reason: "error" });
    }
  }

  const qs = (extra: Record<string, string> = {}) => new URLSearchParams({ url: url.trim(), ...extra }).toString();

  return (
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
          <div className="pop grid gap-2 rounded-xl border border-line bg-white p-3">
            <p className="font-bold">We found it</p>
            <p>{res.name}</p>
            <p className="num"><span className="font-bold">{gbp(res.priceMinor)}</span> <span className="text-ink-soft">on {res.host}</span></p>
            <Link href={`/request?${qs({ title: res.name, price: (res.priceMinor / 100).toFixed(2) })}`} className="btn btn-small btn-gold w-fit">Request this item</Link>
          </div>
        )}
        {res.kind === "none" && (
          <div className="grid gap-2 rounded-xl border border-line bg-white p-3">
            <p>We could not read that page automatically{res.reason === "robots" || res.reason === "blocked" ? " (the shop does not allow it)" : ""}. You can still request it and we will check it for you.</p>
            <Link href={`/request?${qs()}`} className="btn btn-small btn-gold w-fit">Request it anyway</Link>
          </div>
        )}
      </div>
    </form>
  );
}
