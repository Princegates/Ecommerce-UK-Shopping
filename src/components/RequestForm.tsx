"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestAction, type RequestState } from "@/app/actions/request";

export default function RequestForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(requestAction, {});
  const v = state.values ?? {};

  if (state.done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <p className="tag tag-green">Request sent</p>
        <h1 className="mt-3 text-5xl">Thanks, we&rsquo;ll quote it</h1>
        <p className="mt-3 text-ink-soft">
          We will check the price and stock, then contact you on the phone number you gave with the full cost in cedis.
          Nothing is bought until you agree and pay.
        </p>
        <div className="mt-8 flex gap-4">
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
        <h1 className="text-5xl">Request an item by link</h1>
        <ol className="mt-6 grid gap-4">
          {["Find the item on the UK shop's website and choose your size and colour.", "Copy the link and paste it here with the details you see.", "We check the price and stock, then send you the full cost in cedis.", "Pay us once you agree. We buy it and deliver it to you."].map((t, i) => (
            <li key={t} className="flex gap-4">
              <span className="display text-3xl text-green">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </div>

      <form action={action} className="box box-shadow grid gap-4 p-5">
        <div className="field">
          <label className="label" htmlFor="url">Link to the item</label>
          <input id="url" name="url" type="url" className="input" placeholder="https://" required defaultValue={v.url} />
        </div>
        <div className="field">
          <label className="label" htmlFor="title">Item name (optional)</label>
          <input id="title" name="title" className="input" defaultValue={v.title} />
        </div>
        <div className="field">
          <label className="label" htmlFor="details">Size, colour or other details</label>
          <input id="details" name="details" className="input" placeholder="e.g. UK 9, black" defaultValue={v.details} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="quantity">Quantity</label>
            <input id="quantity" name="quantity" type="number" min={1} max={20} className="input" defaultValue={v.quantity || "1"} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="priceSeen">Price you saw (£)</label>
            <input id="priceSeen" name="priceSeen" className="input" inputMode="decimal" placeholder="49.99" defaultValue={v.priceSeen} />
          </div>
        </div>
        <hr className="border-t-2 border-dashed border-ink/40" />
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
