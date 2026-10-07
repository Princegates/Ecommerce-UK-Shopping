"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import Dropdown from "./Dropdown";
import { gbp } from "@/lib/money";

type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "onsite"; slug: string; name: string }
  | { kind: "found"; name: string; priceMinor: number; host: string }
  | { kind: "none"; reason: string }
  | { kind: "invalid" };

/** A visible "Add by link" button: paste a UK product link and we find it, or take your request for it. */
export default function LinkAdd() {
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
    <Dropdown
      align="right"
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-cta px-3 py-1.5 text-sm font-bold text-ink hover:bg-[var(--cta-hover)]"
      panelClassName="w-[min(24rem,92vw)] p-4"
      label={<><span aria-hidden="true" className="text-base leading-none">＋</span> Add by link</>}
    >
      <form onSubmit={find} className="grid gap-3">
        <div>
          <p className="text-base font-bold">Add any UK item by link</p>
          <p className="text-sm text-ink-soft">Paste the product link. We find it, or take your request and quote the full cost in cedis.</p>
        </div>
        <div className="flex gap-2">
          <label htmlFor="link-add-url" className="sr-only">Product link</label>
          <input id="link-add-url" value={url} onChange={(e) => setUrl(e.target.value)} className="input !min-h-10 min-w-0 flex-1" placeholder="https://www.shop.co.uk/product/…" inputMode="url" autoComplete="off" />
          <button className="btn btn-gold !min-h-10 shrink-0" disabled={res.kind === "loading"}>{res.kind === "loading" ? "Looking…" : "Find"}</button>
        </div>
        <div aria-live="polite" className="text-sm">
          {res.kind === "invalid" && <p className="error-text">Paste a full link starting with https://</p>}
          {res.kind === "onsite" && (
            <div className="pop grid gap-2 rounded-xl border border-green bg-green/10 p-3">
              <p className="font-bold text-green">We already list this.</p>
              <p>{res.name}</p>
              <Link href={`/products/${res.slug}`} className="btn btn-small btn-primary w-fit">View item</Link>
            </div>
          )}
          {res.kind === "found" && (
            <div className="pop grid gap-2 rounded-xl border border-line bg-paper-2 p-3">
              <p className="font-bold">We found it</p>
              <p>{res.name}</p>
              <p className="num"><span className="font-bold">{gbp(res.priceMinor)}</span> <span className="text-ink-soft">on {res.host}</span></p>
              <Link href={`/request?${qs({ title: res.name, price: (res.priceMinor / 100).toFixed(2) })}`} className="btn btn-small btn-gold w-fit">Request this item</Link>
            </div>
          )}
          {res.kind === "none" && (
            <div className="grid gap-2 rounded-xl border border-line bg-paper-2 p-3">
              <p>We could not read that page automatically{res.reason === "robots" || res.reason === "blocked" ? " (the shop does not allow it)" : ""}. You can still request it and we will check it for you.</p>
              <Link href={`/request?${qs()}`} className="btn btn-small btn-gold w-fit">Request it anyway</Link>
            </div>
          )}
        </div>
      </form>
    </Dropdown>
  );
}
