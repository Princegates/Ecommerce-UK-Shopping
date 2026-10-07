import Link from "next/link";
import Breakdown from "@/components/Breakdown";
import ProductCard from "@/components/ProductCard";
import ShopTile from "@/components/ShopTile";
import { featuredProducts, listShops } from "@/lib/catalog";
import { gbp } from "@/lib/money";
import { priceOrder } from "@/lib/pricing";
import { getSettings, getShippingMethods, getZones } from "@/lib/settings";

export const dynamic = "force-dynamic";

const STEPS = [
  ["01", "Pick from the shops", "Browse the UK shops we buy from and add what you want to your cart."],
  ["02", "See the full price", "Items, our service charge, shipping and delivery are shown in cedis before you pay."],
  ["03", "Pay once in cedis", "Mobile Money or card. No UK card, no UK address, no forms from the shop."],
  ["04", "We buy, ship, deliver", "We place the order, bring it to Ghana and track it to your door."],
] as const;

export default function HomePage() {
  const settings = getSettings();
  const shops = listShops();
  const popular = featuredProducts(8);
  const methods = getShippingMethods();
  const zones = getZones();
  const method = methods[0];
  const zone = zones[1] ?? zones[0];

  const SAMPLE_PRICE = 8000;
  const SAMPLE_GRAMS = 900;
  const sample =
    method && zone
      ? priceOrder({
          items: [{ id: "sample", unitPriceMinor: SAMPLE_PRICE, quantity: 1, weightGrams: SAMPLE_GRAMS }],
          fx: settings.fx,
          serviceFee: settings.serviceFee,
          rateCard: method.rateCard,
          deliveryFeeMinor: zone.feeMinor,
        })
      : null;

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="border-b-2 border-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:py-16 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <p className="label mb-4">UK shops · Ghana doorstep</p>
            <h1 className="text-[clamp(2.6rem,7vw,5.2rem)]">
              Shop the UK.
              <br />
              Pay in <span className="mark">cedis</span>.
              <br />
              We bring it home.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-soft">
              Pick items from UK shops, see the full price to your door, and pay once. We buy the item, ship it to
              Ghana and deliver it to your address.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/shops" className="btn btn-primary">Browse the shops</Link>
              <Link href="/request" className="btn">Request an item by link</Link>
            </div>
            <ul className="mt-10 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              {["Full price shown before you pay", "Tracked from purchase to delivery", "Price of the item matches the UK shop"].map(
                (t) => (
                  <li key={t} className="flex gap-2">
                    <span aria-hidden="true" className="mono font-semibold text-green">✓</span>
                    {t}
                  </li>
                ),
              )}
            </ul>
          </div>

          {sample && method && zone && (
            <aside aria-label="Example order cost" className="lg:justify-self-end lg:w-full lg:max-w-md">
              <div className="receipt rotate-[0.6deg] p-5">
                <p className="label !text-ink">Example order</p>
                <p className="mt-1 text-sm">
                  1 item at {gbp(SAMPLE_PRICE)} · {SAMPLE_GRAMS} g
                  <br />
                  {method.name} · delivered to {zone.name}
                </p>
                <hr />
                <Breakdown b={sample} />
                <hr />
                <p className="text-xs text-ink-soft">
                  Rates are set by us and can change. Customs duty, if any, is not included. Your own total appears at
                  checkout.
                </p>
              </div>
            </aside>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ how it works */}
      <section id="how" className="scroll-mt-32 border-b-2 border-ink bg-paper-2">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <h2 className="text-4xl">How it works</h2>
          <ol className="mt-8 grid gap-0 md:grid-cols-4">
            {STEPS.map(([n, title, body], i) => (
              <li
                key={n}
                className={`border-t-2 border-dashed border-ink py-5 md:border-t-0 md:py-0 md:pr-6 ${
                  i > 0 ? "md:border-l-2 md:pl-6" : ""
                } md:border-dashed`}
              >
                <p className="display text-5xl text-green">{n}</p>
                <h3 className="mt-2 text-xl">{title}</h3>
                <p className="mt-1 text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------------- shops */}
      <section className="mx-auto max-w-7xl px-4 pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">The shops</p>
            <h2 className="text-4xl">Shop these UK stores</h2>
          </div>
          <Link href="/shops" className="link font-semibold">See all shops →</Link>
        </div>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shops.map((s) => (
            <li key={s.id}>
              <ShopTile shop={s} />
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ popular */}
      <section className="mx-auto max-w-7xl px-4 pt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">Right now</p>
            <h2 className="text-4xl">Popular items</h2>
          </div>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {popular.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} fx={settings.fx} />
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------- request */}
      <section className="mx-auto mt-16 max-w-7xl px-4">
        <div className="box box-shadow grid gap-6 bg-kraft p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-3xl">Can&rsquo;t find it here?</h2>
            <p className="mt-2 max-w-2xl">
              Paste the link to any UK product. We check the price and stock, send you the full cost in cedis, and buy
              it for you once you pay.
            </p>
          </div>
          <Link href="/request" className="btn btn-primary">Request an item by link</Link>
        </div>
      </section>
    </>
  );
}
