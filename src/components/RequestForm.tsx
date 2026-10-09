"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { requestAction, type RequestState } from "@/app/actions/request";
import PhotoImg from "@/components/PhotoImg";
import { normalizeRequestUrl, parseAmazonLink, wrongStoreMessage, type AmazonLink } from "@/lib/amazon-links";
import { gbp } from "@/lib/money";

type Preview =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "onsite"; slug: string; name: string }
  | { kind: "found"; name: string; priceMinor: number; host: string }
  | { kind: "amazon"; link: AmazonLink }
  | { kind: "none"; reason: string };

export default function RequestForm({ initial = {}, signedIn = false, itemTypes = [] }: { initial?: { url?: string; imageUrl?: string; title?: string; priceSeen?: string; name?: string; phone?: string; email?: string }; signedIn?: boolean; itemTypes?: string[] }) {
  const [state, action, pending] = useActionState<RequestState, FormData>(requestAction, {});
  const v: Record<string, string | undefined> = { ...initial, ...(state.values ?? {}) };
  const [title, setTitle] = useState(v.title ?? "");
  const [price, setPrice] = useState(v.priceSeen ?? "");
  // a link that arrives already filled in (from the Amazon button, the share sheet or the bookmarklet) is recognised straight away
  const [preview, setPreview] = useState<Preview>(() => {
    const amazon = v.url ? parseAmazonLink(v.url) : null;
    return amazon ? { kind: "amazon", link: amazon } : { kind: "idle" };
  });
  const [url, setUrl] = useState(v.url ?? "");
  const lastUrl = useRef("");

  async function look(raw: string) {
    // text shared from the Amazon app has the link inside a sentence; an Amazon UK link is tidied to the plain product page
    const clean = normalizeRequestUrl(raw);
    const url = clean.url.trim();
    if (!/^https?:\/\//i.test(url) || url === lastUrl.current) return;
    lastUrl.current = url;
    if (url !== raw.trim()) setUrl(url);
    const amazon = parseAmazonLink(url);
    if (amazon) {
      setPreview({ kind: "amazon", link: amazon });
      return;
    }
    setPreview({ kind: "loading" });
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      const j = await res.json();
      if (j.ok && j.onSite) setPreview({ kind: "onsite", slug: j.onSite.slug, name: j.onSite.name });
      else if (j.ok) {
        setPreview({ kind: "found", name: j.name, priceMinor: j.priceMinor, host: j.host });
        setTitle((t) => t || j.name);
        setPrice((p) => p || (j.priceMinor / 100).toFixed(2));
      } else setPreview({ kind: "none", reason: j.reason ?? "error" });
    } catch {
      setPreview({ kind: "none", reason: "error" });
    }
  }

  if (state.done && state.quote) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <p className="tag tag-green">Your price is ready</p>
        <h1 className="mt-3 text-3xl">We priced it for you</h1>
        <p className="mt-3 text-ink-soft">
          {state.quote.source === "page" ? "We read the price on the shop's website." : "We used the price you gave, with a small safety margin."} Open your price to see the
          full cost in cedis, choose delivery and pay. The price is held for a few days. We check the shop&rsquo;s price again before buying.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href={`/quote/${state.quote.token}`} className="btn btn-gold !px-6 !text-base">See my price and pay</Link>
          <Link href="/shops" className="btn">Keep browsing</Link>
        </div>
      </div>
    );
  }

  if (state.done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <p className="tag tag-green">Request sent</p>
        <h1 className="mt-3 text-3xl">Thanks, we&rsquo;ll quote it</h1>
        <p className="mt-3 text-ink-soft">
          We will check the price and stock, then send you the full cost in cedis by message{signedIn ? " and show it in your account" : ""}, with a link to pay.
          Nothing is bought until you agree and pay. Your order then appears in your account with tracking, like any other order.
        </p>
        <div className="mt-8 flex gap-4">
          {signedIn && <Link href="/account#requests" className="btn btn-gold">See my requests</Link>}
          <Link href="/shops" className="btn btn-primary">Keep browsing</Link>
          <Link href="/" className="btn">Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 md:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="label">Not in our shops?</p>
        <h1 className="text-3xl">Request any item from the UK</h1>
        <ol className="mt-6 grid gap-4">
          {["Tell us what you want, for example \"OnePlus 13 256GB\". If you already have a link from the UK shop, paste it too.", "We find it, check the price and stock, and send you the full cost in cedis.", "Pay us once you agree. We buy it and deliver it to you."].map((t, i) => (
            <li key={t} className="flex gap-4">
              <span className="display text-3xl text-green">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </div>

      <form action={action} className="box box-shadow grid gap-4 p-5">
        <div className="field">
          <label className="label" htmlFor="url">Link to the item (optional)</label>
          <input id="url" name="url" type="url" className="input" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={(e) => look(e.target.value)} onPaste={(e) => { const t = e.clipboardData.getData("text"); window.setTimeout(() => look(t), 0); }} />
          <div aria-live="polite">
            {preview.kind === "loading" && <p className="hint">Checking the link…</p>}
            {preview.kind === "onsite" && (
              <p className="pop mt-1 rounded-lg border border-green bg-green/10 p-3 text-sm font-semibold text-green">
                Good news: we already list this. <Link href={`/products/${preview.slug}`} className="link">View {preview.name} ›</Link>
              </p>
            )}
            {preview.kind === "found" && (
              <p className="pop mt-1 rounded-lg border border-line bg-paper-2 p-3 text-sm">
                <span className="font-bold">We found it:</span> {preview.name} · <span className="num font-bold">{gbp(preview.priceMinor)}</span> on {preview.host}.{" "}
                <span className="text-ink-soft">We filled in the details below. Please check them and add your size or colour.</span>
              </p>
            )}
            {preview.kind === "amazon" && (preview.link.store === "uk" || preview.link.store === "short") && (
              <div className="pop mt-1 flex gap-3 rounded-lg border border-line bg-paper-2 p-3 text-sm">
                {v.imageUrl && <PhotoImg src={v.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded object-contain" fallback={null} />}
                <p>
                  <span className="font-bold">Amazon UK item{preview.link.asin ? ` ${preview.link.asin}` : ""}.</span>{" "}
                  Choose your size or colour on Amazon first, then type the price you see below. We confirm the real price before you pay.
                  {preview.link.store === "short" && <span className="text-ink-soft"> This is a short Amazon link, which is fine. We will open it to check.</span>}
                </p>
              </div>
            )}
            {preview.kind === "amazon" && (preview.link.store === "us" || preview.link.store === "other") && (
              <div role="alert" className="pop mt-1 rounded-lg border border-red bg-red/10 p-3 text-sm">
                <p className="font-semibold text-red">{wrongStoreMessage(preview.link)}</p>
                {preview.link.ukUrl && <button type="button" className="btn btn-small mt-2" onClick={() => { setUrl(preview.link.ukUrl!); lastUrl.current = ""; void look(preview.link.ukUrl!); }}>Use the Amazon UK link</button>}
              </div>
            )}
            {preview.kind === "none" && preview.reason !== "invalid" && (
              <p className="hint mt-1">We could not read that page automatically{preview.reason === "robots" || preview.reason === "blocked" ? " (the shop does not allow it)" : ""}. No problem: fill in the details below and we will check it for you.</p>
            )}
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="title">{url.trim() ? "Item name (optional)" : "What do you want?"}</label>
          <input id="title" name="title" className="input" required={!url.trim()} placeholder="e.g. OnePlus 13 256GB, black" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="details">Size, colour or other details</label>
          <input id="details" name="details" className="input" placeholder="e.g. UK 9, black" defaultValue={v.details} />
        </div>
        {itemTypes.length > 0 && (
          <div className="field">
            <label className="label" htmlFor="itemType">What kind of item is it?</label>
            <select id="itemType" name="itemType" className="select" defaultValue={v.itemType ?? itemTypes[itemTypes.length - 1]}>
              {itemTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <p className="hint">This helps us work out shipping.</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="quantity">Quantity</label>
            <input id="quantity" name="quantity" type="number" min={1} max={20} className="input" defaultValue={v.quantity || "1"} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="priceSeen">Price you saw (£)</label>
            <input id="priceSeen" name="priceSeen" className="input" inputMode="decimal" placeholder="49.99" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        <hr className="border-t-2 border-solid border-line" />
        <div className="field">
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" name="name" className="input" autoComplete="name" required defaultValue={v.name} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" required defaultValue={v.phone} />
          </div>
          <div className="field">
            <label className="label" htmlFor="email">Email (optional)</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={v.email} />
          </div>
        </div>
        <div aria-live="polite">{state.error && <p className="error-text" role="alert">{state.error}</p>}</div>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send request"}</button>
        <p className="hint">The price you enter is a guide. We confirm the real price before you pay.</p>
      </form>
    </div>
  );
}
