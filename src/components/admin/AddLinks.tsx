"use client";

import { useActionState } from "react";
import { importLinksAction, type LinksState } from "@/app/admin/ingest-actions";
import { gbp } from "@/lib/money";

const TONE: Record<string, string> = { added: "tag-green", updated: "tag-green", exists: "", robots: "tag-gold", blocked: "tag-gold", "no-data": "tag-gold", "wrong-currency": "tag-gold", unsafe: "tag-gold", error: "tag-gold" };

export default function AddLinks({ shops }: { shops: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<LinksState, FormData>(importLinksAction, {});
  return (
    <section className="box box-shadow grid gap-4 p-5" aria-labelledby="links-h">
      <div>
        <h2 id="links-h" className="text-2xl">Add items by link</h2>
        <p className="text-ink-soft">
          Paste product links from a UK shop, one per line. We read the name, price, image and stock from each page and put the item on the site.
          Prices are re-checked automatically. Pages that forbid automated reading in robots.txt are skipped.
        </p>
      </div>
      <form action={action} className="grid gap-3">
        <div className="field">
          <label className="label" htmlFor="links-shop">Shop</label>
          <select id="links-shop" name="shopId" className="select">
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="links-urls">Product links (up to 20)</label>
          <textarea id="links-urls" name="urls" rows={4} className="textarea mono text-sm" placeholder={"https://www.example.co.uk/product/blue-teapot\nhttps://www.example.co.uk/product/mug"} required />
        </div>
        <button className="btn btn-primary w-fit" disabled={pending}>{pending ? "Reading pages…" : "Add these items"}</button>
      </form>
      <div aria-live="polite">
        {state.error && <p role="alert" className="error-text">{state.error}</p>}
        {state.results && (
          <ul className="grid gap-2">
            {state.results.map((r) => (
              <li key={r.url} className="box grid gap-1 p-3 text-sm">
                <p className="break-all"><span className={`tag ${TONE[r.status] ?? ""} mr-2`}>{r.status.replace("-", " ")}</span>{r.name ? <strong>{r.name}</strong> : r.url}{r.priceMinor ? <span className="num"> · {gbp(r.priceMinor)}</span> : null}</p>
                <p className="text-ink-soft">{r.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
