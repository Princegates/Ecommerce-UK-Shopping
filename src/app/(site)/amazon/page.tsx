import type { Metadata } from "next";
import Link from "next/link";
import AmazonTools from "@/components/shop/AmazonTools";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order from Amazon UK" };

export default function AmazonPage() {
  const { siteName } = getSettings();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="label">Most popular</p>
      <h1 className="text-4xl">Order from Amazon UK</h1>
      <p className="mt-3 text-lg text-ink-soft">
        Find anything on Amazon UK, send us the link, and we buy it and bring it to you in Ghana. You see the full price in cedis before you pay.
      </p>

      <ol className="mt-8 grid gap-8">
        <li>
          <h2 className="text-2xl"><span className="num mr-2 text-green">1</span>Find it on Amazon UK</h2>
          <form action="https://www.amazon.co.uk/s" method="get" target="_blank" className="mt-3 flex flex-wrap gap-3">
            <label className="sr-only" htmlFor="k">What are you looking for?</label>
            <input id="k" name="k" className="input min-w-0 flex-1" placeholder="e.g. OnePlus 15R, air fryer, Nike trainers" autoComplete="off" />
            <button className="btn btn-gold">Search Amazon UK ↗</button>
          </form>
          <p className="hint mt-2">It must be the UK store (amazon.co.uk), because we buy in the UK and ship from here. Choose your size, colour or model on Amazon first.</p>
        </li>

        <li>
          <h2 className="text-2xl"><span className="num mr-2 text-green">2</span>Send it to us</h2>
          <form action="/request" method="get" className="mt-3 flex flex-wrap gap-3">
            <label className="sr-only" htmlFor="url">The Amazon link</label>
            <input id="url" name="url" className="input min-w-0 flex-1" placeholder="Paste the Amazon link here" autoComplete="off" required />
            <button className="btn btn-primary">Request this item</button>
          </form>
          <p className="hint mt-2">A link, or the text the Amazon app shares, both work. Short links (a.co, amzn.to) are fine.</p>
          <div className="mt-5"><AmazonTools siteName={siteName} /></div>
        </li>

        <li>
          <h2 className="text-2xl"><span className="num mr-2 text-green">3</span>We price it, you pay, we ship</h2>
          <p className="mt-2">
            We check the price and stock on Amazon, then send you the full cost in cedis: the item, our service charge, shipping to Ghana and delivery to your door. Nothing is bought until you agree and pay.
            Then you can follow your order in your <Link href="/account/orders" className="link">account</Link>.
          </p>
        </li>
      </ol>

      <section className="box mt-10 p-5" aria-labelledby="good-h">
        <h2 id="good-h" className="text-xl">Good to know</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          <li>Amazon&rsquo;s price can change at any moment, so the price you see is a guide. We confirm the real price before you pay.</li>
          <li>Links to Amazon&rsquo;s US or other country stores are not accepted. We buy from amazon.co.uk only. If the same item is sold on the UK store, use that link.</li>
          <li>Import duty and taxes charged by customs, if any, are not included.</li>
          <li>Some items cannot be shipped (for example batteries on their own, liquids and aerosols). We will tell you if yours cannot.</li>
        </ul>
      </section>
    </div>
  );
}
