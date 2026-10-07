import Link from "next/link";
import Breakdown from "@/components/Breakdown";
import ShopTile from "@/components/ShopTile";
import StatusTracker from "@/components/StatusTracker";
import Carousel from "@/components/shop/Carousel";
import Countdown from "@/components/shop/Countdown";
import ProductShelf from "@/components/shop/ProductShelf";
import RecentlyViewed from "@/components/shop/RecentlyViewed";
import { bestSellerIds } from "@/lib/analytics";
import { dealPercent, dealProducts, listDepartments, listShops, newArrivals, productsByIds, queryProducts, getProductById, type Product } from "@/lib/catalog";
import { gbp } from "@/lib/money";
import { listOrdersForCustomer, reorderableItems } from "@/lib/orders";
import { STATUS_LABEL } from "@/lib/order-status";
import { priceOrder } from "@/lib/pricing";
import { getShopper } from "@/lib/shopper";
import { getSettings, getShippingMethods, getZones } from "@/lib/settings";

export const dynamic = "force-dynamic";

const STEPS = [
  ["01", "Pick from the shops", "Browse UK shops and add what you want to your cart."],
  ["02", "See the full price", "Items, service charge, shipping and delivery, in cedis, before you pay."],
  ["03", "Pay once in cedis", "Mobile Money or card. No UK card or UK address needed."],
  ["04", "We buy, ship, deliver", "We order it, bring it to Ghana and track it to your door."],
] as const;

const TRUST = [
  ["Pay in cedis", "Mobile Money and cards"],
  ["Tracked end to end", "From UK shop to your door"],
  ["We buy it for you", "No UK card or address"],
  ["Full price upfront", "No surprises at checkout"],
] as const;

export default async function HomePage() {
  const settings = getSettings();
  const shopper = await getShopper();
  const departments = listDepartments();
  const shops = listShops();
  const deals = dealProducts(12);
  const arrivals = newArrivals(12);

  const soldIds = bestSellerIds(12);
  const sold = productsByIds(soldIds);
  const bestIsReal = sold.length >= 4;
  const featured: Product[] = bestIsReal ? sold : queryProducts({ sort: "rating", limit: 12 }).items;

  // sample cost for the hero receipt, from the live settings
  const method = getShippingMethods()[0];
  const zone = getZones()[1] ?? getZones()[0];
  const sample = method && zone
    ? priceOrder({ items: [{ id: "s", unitPriceMinor: 8000, quantity: 1, weightGrams: 900 }], fx: settings.fx, serviceFee: settings.serviceFee, rateCard: method.rateCard, deliveryFeeMinor: zone.feeMinor })
    : null;

  const orders = shopper.customer ? listOrdersForCustomer(shopper.customer.id) : [];
  const latestOpen = orders.find((o) => o.status !== "AWAITING_PAYMENT" && !["DELIVERED", "CANCELLED", "REFUNDED"].includes(o.status));
  const seen = new Set<number>();
  const again: Product[] = [];
  for (const o of orders.slice(0, 5)) {
    for (const i of reorderableItems(shopper.customer!.id, o.number)) {
      if (seen.has(i.productId)) continue;
      seen.add(i.productId);
      const p = getProductById(i.productId);
      if (p) again.push(p);
    }
  }

  const bestDeal = deals.reduce((m, p) => Math.max(m, dealPercent(p)), 0);
  const nextEnd = deals.map((p) => p.dealEndsAt).filter((v): v is string => Boolean(v)).sort()[0];

  const slides = [
    (
      <div key="one" className="grid gap-8 border-2 border-ink bg-paper-3 p-6 md:grid-cols-[1.2fr_1fr] md:items-center md:p-10">
        <div>
          <p className="label mb-3">UK shops · Ghana doorstep</p>
          <h1 className="text-[clamp(2.2rem,5.5vw,4.4rem)]">Shop the UK.<br />Pay in <span className="mark">cedis</span>.<br />We bring it home.</h1>
          <p className="mt-4 max-w-lg text-lg text-ink-soft">Pick items from UK shops, see the full price to your door, and pay once. We buy it, ship it and deliver it.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/shops" className="btn btn-primary">Browse the shops</Link>
            <Link href="/search?deals=1&sort=discount" className="btn btn-gold">See today&rsquo;s deals</Link>
          </div>
        </div>
        {sample && method && zone && (
          <div className="receipt rotate-[0.6deg] p-5">
            <p className="label !text-ink">Example order</p>
            <p className="mt-1 text-sm">1 item at {gbp(8000)} · 900 g<br />{method.name} · to {zone.name}</p>
            <hr />
            <Breakdown b={sample} />
          </div>
        )}
      </div>
    ),
    (
      <div key="two" className="grid gap-6 border-2 border-ink bg-red p-6 text-white md:grid-cols-[1.3fr_1fr] md:items-center md:p-10">
        <div>
          <p className="label !text-white/80">Limited-time prices</p>
          <h2 className="text-[clamp(2.2rem,5vw,4rem)] text-white">{bestDeal > 0 ? `Up to ${bestDeal}% off` : "Deals on UK favourites"}</h2>
          <p className="mt-3 max-w-lg text-lg text-white/90">Real savings on items from our UK shops, with the full cost to your door shown before you pay.</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/search?deals=1&sort=discount" className="btn btn-gold">Shop the deals</Link>
            {nextEnd && <p className="font-semibold">Next ends in <Countdown endsAt={nextEnd} className="text-gold" /></p>}
          </div>
        </div>
        <ul className="grid grid-cols-3 gap-2" aria-label="Some of today's deals">
          {deals.slice(0, 3).map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.slug}`} className="block border-2 border-ink bg-paper-3 text-ink hover:-translate-y-0.5">
                <div className="grid aspect-square place-items-center text-2xl font-bold text-white" style={{ background: p.shopAccent }} aria-hidden="true">{p.name.slice(0, 2)}</div>
                <p className="num p-1.5 text-center text-sm font-bold">-{dealPercent(p)}%</p>
                <span className="sr-only">{p.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ),
    (
      <div key="three" className="grid gap-6 border-2 border-ink bg-kraft p-6 md:grid-cols-[1.3fr_1fr] md:items-center md:p-10">
        <div>
          <p className="label">Not in our shops?</p>
          <h2 className="text-[clamp(2.2rem,5vw,4rem)]">Send us any UK link</h2>
          <p className="mt-3 max-w-lg text-lg">Paste the link, we check the price and stock, quote the full cost in cedis, and buy it once you pay.</p>
          <Link href="/request" className="btn btn-primary mt-6">Request an item by link</Link>
        </div>
        <ol className="grid gap-3">
          {["Paste the link", "We quote the full cost", "You pay, we buy it"].map((t, i) => (
            <li key={t} className="flex items-center gap-3 border-2 border-ink bg-paper-3 p-3 font-semibold"><span className="display text-3xl text-green">{i + 1}</span>{t}</li>
          ))}
        </ol>
      </div>
    ),
  ];

  return (
    <>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Carousel slides={slides} label="Featured offers" />
        <aside aria-label={shopper.customer ? "Your account" : "Sign in"} className="grid content-start gap-4">
          {shopper.customer ? (
            <div className="box box-shadow grid gap-3 p-5">
              <p className="label">Welcome back</p>
              <h2 className="text-2xl">{shopper.customer.name.split(" ")[0]}</h2>
              {latestOpen ? (
                <>
                  <p className="text-sm"><span className="mono font-semibold">{latestOpen.number}</span><br />{STATUS_LABEL[latestOpen.status]}</p>
                  <div className="hidden xl:block"><StatusTracker status={latestOpen.status} /></div>
                  <Link href={`/account/orders/${latestOpen.number}`} className="btn btn-small btn-primary">Track this order</Link>
                </>
              ) : (
                <p className="text-sm text-ink-soft">Your orders and tracking live in your account.</p>
              )}
              <Link href="/account/orders" className="link text-sm font-bold">All orders →</Link>
            </div>
          ) : (
            <div className="box box-shadow grid gap-3 p-5">
              <h2 className="text-2xl">Sign in for the best experience</h2>
              <ul className="grid gap-1 text-sm text-ink-soft">
                <li>✓ Track every order</li>
                <li>✓ Save items and addresses</li>
                <li>✓ Check out in seconds</li>
              </ul>
              <Link href="/login" className="btn btn-primary">Sign in</Link>
              <Link href="/register" className="btn btn-small">Create an account</Link>
            </div>
          )}
          <Link href="/request" className="box box-shadow block bg-gold p-5 hover:-translate-y-0.5">
            <p className="label !text-ink">Not in our shops?</p>
            <p className="display mt-1 text-xl">Request any UK item by link →</p>
          </Link>
        </aside>
      </section>

      <section aria-label="Why shop here" className="mx-auto mt-8 max-w-7xl px-4">
        <ul className="grid grid-cols-2 gap-px border-2 border-ink bg-ink md:grid-cols-4">
          {TRUST.map(([t, s]) => (
            <li key={t} className="bg-paper-3 p-4"><p className="font-bold">{t}</p><p className="text-sm text-ink-soft">{s}</p></li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dept-h" className="mx-auto max-w-7xl px-4 pt-14">
        <h2 id="dept-h" className="text-3xl md:text-4xl">Shop by department</h2>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {departments.map((d) => (
            <li key={d.slug}>
              <Link href={`/department/${d.slug}`} className="box group flex aspect-[5/4] flex-col justify-between p-3 text-white hover:-translate-y-0.5" style={{ background: d.accent }}>
                <span className="display text-xl leading-tight">{d.name}</span>
                <span className="mono text-xs opacity-90">{d.products} items</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ProductShelf id="deals" title="Today's deals" subtitle={nextEnd ? <>Next deal ends in <Countdown endsAt={nextEnd} className="font-bold text-red" /></> : "Real savings on UK favourites"} products={deals} shopper={shopper} href="/search?deals=1&sort=discount" countdown accent />
      <ProductShelf id="best" title={bestIsReal ? "Best sellers" : "Top picks"} subtitle={bestIsReal ? "What other shoppers bought in the last 30 days" : "A selection to get you started"} products={featured} shopper={shopper} href="/search?sort=rating" />
      {again.length > 0 && <ProductShelf id="again" title="Buy it again" subtitle="From your past orders" products={again.slice(0, 12)} shopper={shopper} href="/account/orders" linkLabel="Your orders" />}
      <RecentlyViewed />

      <section aria-labelledby="shops-h" className="mx-auto max-w-7xl px-4 pt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="shops-h" className="text-3xl md:text-4xl">Shop these UK stores</h2>
          <Link href="/shops" className="link font-bold">All shops →</Link>
        </div>
        <ul className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shops.map((s) => <li key={s.id}><ShopTile shop={s} /></li>)}
        </ul>
      </section>

      <ProductShelf id="new" title="New arrivals" products={arrivals} shopper={shopper} href="/search?sort=newest" badge="new" />

      <section id="how" aria-labelledby="how-h" className="mt-16 scroll-mt-40 border-y-2 border-ink bg-paper-2">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <h2 id="how-h" className="text-3xl md:text-4xl">How it works</h2>
          <ol className="mt-8 grid gap-0 md:grid-cols-4">
            {STEPS.map(([n, title, body], i) => (
              <li key={n} className={`border-t-2 border-dashed border-ink py-5 md:border-t-0 md:py-0 md:pr-6 ${i > 0 ? "md:border-l-2 md:pl-6" : ""}`}>
                <p className="display text-5xl text-green">{n}</p>
                <h3 className="mt-2 text-xl">{title}</h3>
                <p className="mt-1 text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
