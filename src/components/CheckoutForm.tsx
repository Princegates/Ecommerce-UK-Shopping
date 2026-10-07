"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { placeOrderAction, type CheckoutState } from "@/app/actions/checkout";
import Breakdown from "@/components/Breakdown";
import { computeQuote, DeliverySelectors, type QuoteConfig } from "@/components/quote-client";
import { ghs } from "@/lib/money";
import { ghsToGbpMinor, type PriceableItem } from "@/lib/pricing";

type Summary = { itemId: string; name: string; shop: string; options: string; quantity: number; lineGhsMinor: number };
type Addr = { id: number; label: string; recipient: string; phone: string; zoneId: number | null; address: string; landmark: string; isDefault: boolean };
type Profile = { name: string; phone: string; email: string; notifySms: boolean; notifyEmail: boolean; notifyWhatsapp: boolean };

export default function CheckoutForm({
  items, summary, cfg, initialZone, initialShip, profile, addresses, selectedAddressId,
}: {
  items: PriceableItem[];
  summary: Summary[];
  cfg: QuoteConfig;
  initialZone: number;
  initialShip: string;
  profile: Profile;
  addresses: Addr[];
  selectedAddressId: number | null;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, {});
  const first = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const [choice, setChoice] = useState<number | "new">(first ? first.id : "new");
  const [zoneId, setZoneId] = useState(initialZone);
  const [code, setCode] = useState(initialShip);
  const [name, setName] = useState(first?.recipient ?? profile.name);
  const [phone, setPhone] = useState(first?.phone ?? profile.phone);
  const [address, setAddress] = useState(first?.address ?? "");
  const [landmark, setLandmark] = useState(first?.landmark ?? "");
  const quote = useMemo(() => computeQuote(items, cfg, zoneId, code), [items, cfg, zoneId, code]);
  const v = state.values ?? {};

  function pick(next: number | "new") {
    setChoice(next);
    const a = typeof next === "number" ? addresses.find((x) => x.id === next) : undefined;
    if (a) {
      setName(a.recipient);
      setPhone(a.phone);
      setAddress(a.address);
      setLandmark(a.landmark);
      if (a.zoneId && cfg.zones.some((z) => z.id === a.zoneId)) setZoneId(a.zoneId);
    } else {
      setName(profile.name);
      setPhone(profile.phone);
      setAddress("");
      setLandmark("");
    }
  }

  return (
    <form action={action} className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid content-start gap-8">
        {addresses.length > 0 && (
          <section className="box box-shadow grid gap-3 p-5" aria-labelledby="saved-h">
            <h2 id="saved-h" className="text-2xl">Deliver to</h2>
            <div className="grid gap-2">
              {addresses.map((a) => (
                <label key={a.id} className={`box flex cursor-pointer items-start gap-3 p-3 ${choice === a.id ? "!bg-gold/40" : ""}`}>
                  <input type="radio" name="addressChoice" checked={choice === a.id} onChange={() => pick(a.id)} className="mt-1 h-4 w-4 accent-[var(--green)]" />
                  <span>
                    <span className="block font-semibold">{a.label}{a.isDefault && <span className="tag tag-green ml-2">Default</span>}</span>
                    <span className="block text-sm text-ink-soft">{a.recipient} · {a.address}</span>
                  </span>
                </label>
              ))}
              <label className={`box flex cursor-pointer items-center gap-3 p-3 ${choice === "new" ? "!bg-gold/40" : ""}`}>
                <input type="radio" name="addressChoice" checked={choice === "new"} onChange={() => pick("new")} className="h-4 w-4 accent-[var(--green)]" />
                <span className="font-semibold">Use a new address</span>
              </label>
            </div>
            <p className="hint"><Link href="/account/addresses" className="link">Manage saved addresses</Link></p>
          </section>
        )}

        <section className="box box-shadow grid gap-4 p-5">
          <h2 className="text-2xl">Delivery details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="customerName">Recipient name</label>
              <input id="customerName" name="customerName" className="input" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="phone">Phone for the rider</label>
              <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="email">Email for your receipt (optional)</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={v.email ?? profile.email} />
          </div>
          <DeliverySelectors cfg={cfg} zoneId={zoneId} code={code} onZone={setZoneId} onCode={setCode} idPrefix="co" />
          <div className="field">
            <label className="label" htmlFor="address">Address</label>
            <textarea id="address" name="address" className="textarea" autoComplete="street-address" placeholder="House number, street, area, town" required value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="landmark">Landmark or GhanaPost GPS code (optional)</label>
            <input id="landmark" name="landmark" className="input" placeholder="e.g. opposite the pharmacy, GA-123-4567" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="notes">Note for the rider (optional)</label>
            <input id="notes" name="notes" className="input" defaultValue={v.notes} />
          </div>
          {choice === "new" && (
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" name="saveAddress" defaultChecked className="h-5 w-5 accent-[var(--green)]" /> Save this address to my account
              </label>
              <input name="addressLabel" className="input !w-40" placeholder="Label, e.g. Home" maxLength={30} aria-label="Address label" />
            </div>
          )}
        </section>

        <section className="box box-shadow grid gap-2 p-5">
          <h2 className="text-2xl">Order updates</h2>
          <p className="text-sm text-ink-soft">Tell me when my order is bought, received in the UK, shipped, out for delivery and delivered, by:</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {([["notifySms", "SMS", profile.notifySms], ["notifyEmail", "Email", profile.notifyEmail], ["notifyWhatsapp", "WhatsApp", profile.notifyWhatsapp]] as const).map(([n, label, on]) => (
              <label key={n} className="flex items-center gap-2 font-semibold">
                <input type="checkbox" name={n} defaultChecked={on} className="h-5 w-5 accent-[var(--green)]" /> {label}
              </label>
            ))}
          </div>
          <p className="hint">Tracking is always available in your account under Orders.</p>
        </section>
      </div>

      <aside className="grid content-start gap-4 lg:sticky lg:top-44 lg:self-start">
        <div className="receipt p-5">
          <h2 className="!text-2xl">Your order</h2>
          <ul className="mt-3 grid gap-2 font-sans text-sm">
            {summary.map((s) => (
              <li key={s.itemId} className="flex justify-between gap-3">
                <span>
                  <span className="font-semibold">{s.quantity} × {s.name}</span>
                  <span className="block text-ink-soft">{s.shop}{s.options ? ` · ${s.options}` : ""}</span>
                </span>
                <span className="num whitespace-nowrap">{ghs(s.lineGhsMinor)}</span>
              </li>
            ))}
          </ul>
          <hr />
          {quote ? <Breakdown b={quote} approxGbpMinor={ghsToGbpMinor(quote.totalMinor, cfg.fx)} /> : <p>Choose a delivery area and shipping method.</p>}
          <hr />
          <p className="text-xs text-ink-soft">
            Import duty charged by customs, if any, is not included. You pay us in cedis; we buy the items from the UK shops for you.
          </p>
        </div>

        <div aria-live="polite">{state.error && <p className="error-text" role="alert">{state.error}</p>}</div>
        <button className="btn btn-primary w-full !text-lg" disabled={pending || !quote}>
          {pending ? "Placing order…" : quote ? `Place order and pay ${ghs(quote.totalMinor)}` : "Place order"}
        </button>
        <p className="hint">The next step is payment. Your order is only bought once payment is confirmed.</p>
      </aside>
    </form>
  );
}
