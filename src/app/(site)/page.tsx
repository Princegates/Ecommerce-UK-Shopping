import Link from "next/link";
import Breakdown from "@/components/Breakdown";
import ProductArt from "@/components/ProductArt";
import DepartmentIcon from "@/components/DepartmentIcon";
import LinkFinder from "@/components/shop/LinkFinder";
import Marquee from "@/components/shop/Marquee";
import Reveal from "@/components/shop/Reveal";
import ShopTile from "@/components/ShopTile";
import StatusTracker from "@/components/StatusTracker";
import Carousel from "@/components/shop/Carousel";
import Countdown from "@/components/shop/Countdown";
import ProductShelf from "@/components/shop/ProductShelf";
import RecentlyViewed from "@/components/shop/RecentlyViewed";
import { bestSellerIds } from "@/lib/analytics";
import { dealPercent, dealProducts, listDepartments, listShops, newArrivals, productsByIds, queryProducts, getProductById, type Product } from "@/lib/catalog";
import { gbp, ghs } from "@/lib/money";
import { listOrdersForCustomer, reorderableItems } from "@/lib/orders";
import { STATUS_LABEL } from "@/lib/order-status";
import { gbpToGhsMinor, ghsToGbpMinor, priceOrder } from "@/lib/pricing";
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

  const hero = "relative isolate overflow-hidden px-5 pb-14 pt-8 text-white md:px-20 md:pb-16 md:pt-12";
  const slides = [
    (
      <div key="one" className={`${hero} hero-a`}>
        <span className="woven absolute inset-0 -z-10" aria-hidden="true" />
        <span className="float-slow absolute -right-10 -top-10 -z-10 h-56 w-56 rounded-full bg-spark/30" aria-hidden="true" />
        <span className="float-slower absolute bottom-10 right-1/3 -z-10 h-24 w-24 rounded-full bg-white/10" aria-hidden="true" />
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div className="stagger">
            <p className="text-sm font-bold text-spark">UK shops · Ghana doorstep</p>
            <h1 className="mt-2 text-[clamp(2rem,4.6vw,3.6rem)] font-bold leading-[1.05]">Shop the UK.<br />Pay in <span className="text-spark">cedis</span>.<br />We bring it home.</h1>
            <p className="mt-4 max-w-lg text-lg text-white/90">See every price in pounds and cedis, pay once, and track your order from the UK shop to your door.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#paste-link" className="btn btn-gold !px-6 !text-base">Paste a product link</a>
              <Link href="/shops" className="btn !border-white/60 !bg-white/10 !text-white hover:!bg-white/20">Browse our shops</Link>
            </div>
          </div>
          {sample && method && zone && (
            <div className="receipt hidden p-5 text-ink md:block md:-rotate-1">
              <p className="font-bold">Example order</p>
              <p className="mt-1 text-sm text-ink-soft">1 item at {gbp(8000)} · 900 g · {method.name} to {zone.name}</p>
              <hr />
              <Breakdown b={sample} approxGbpMinor={ghsToGbpMinor(sample.totalMinor, settings.fx)} />
            </div>
          )}
        </div>
      </div>
    ),
    (
      <div key="two" className={`${hero} hero-b`}>
        <span className="woven absolute inset-0 -z-10" aria-hidden="true" />
        <span className="float-slow absolute -left-10 top-10 -z-10 h-48 w-48 rounded-full bg-red/40" aria-hidden="true" />
        <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div className="stagger">
            <p className="flex items-center gap-2 text-sm font-bold text-spark"><span className="live-dot" aria-hidden="true" /> Limited-time prices</p>
            <h2 className="mt-2 text-[clamp(2rem,4.6vw,3.6rem)] font-bold leading-[1.05]">{bestDeal > 0 ? `Up to ${bestDeal}% off` : "Deals on UK favourites"}</h2>
            <p className="mt-3 max-w-lg text-lg text-white/90">Real savings from our UK shops, with the full cost to your door shown before you pay.</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link href="/search?deals=1&sort=discount" className="btn btn-gold !px-6 !text-base">Shop the deals</Link>
              {nextEnd && <p className="font-semibold">Next ends in <Countdown endsAt={nextEnd} className="text-spark" /></p>}
            </div>
          </div>
          <ul className="hidden grid-cols-3 gap-2 md:grid" aria-label="Some of today's deals">
            {deals.slice(0, 3).map((p) => (
              <li key={p.id}>
                <Link href={`/products/${p.slug}`} className="lift block overflow-hidden rounded-2xl bg-white text-ink">
                  <ProductArt name={p.name} accent={p.shopAccent} imageUrl={p.imageUrl} category={p.category} />
                  <p className="num bg-red p-1.5 text-center text-sm font-bold text-white">-{dealPercent(p)}%</p>
                  <span className="sr-only">{p.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
    (
      <div key="three" className={`${hero} hero-c`}>
        <span className="woven absolute inset-0 -z-10" aria-hidden="true" />
        <span className="float-slower absolute -right-6 bottom-6 -z-10 h-52 w-52 rounded-full bg-spark/25" aria-hidden="true" />
        <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div className="stagger">
            <p className="text-sm font-bold text-spark">Not in our shops?</p>
            <h2 className="mt-2 text-[clamp(2rem,4.6vw,3.6rem)] font-bold leading-[1.05]">Send us any UK link</h2>
            <p className="mt-3 max-w-lg text-lg text-white/90">Paste the link. We read the price, quote the full cost in cedis, and buy it once you pay.</p>
            <a href="#paste-link" className="btn btn-gold mt-6 !px-6 !text-base">Paste a product link</a>
          </div>
          <ol className="hidden gap-3 md:grid">
            {["Paste the link", "We quote the full cost", "You pay, we buy it"].map((t, i) => (
              <li key={t} className="flex items-center gap-3 rounded-2xl bg-white/95 p-3 font-semibold text-ink"><span className="grid h-8 w-8 place-items-center rounded-full bg-green text-white">{i + 1}</span>{t}</li>
            ))}
          </ol>
        </div>
      </div>
    ),
  ];

  const mini = (list: Product[]) => (
    <ul className="grid grid-cols-2 gap-3">
      {list.slice(0, 4).map((p) => (
        <li key={p.id}>
          <Link href={`/products/${p.slug}`} className="group block">
            <span className="block overflow-hidden rounded"><ProductArt name={p.name} accent={p.shopAccent} imageUrl={p.imageUrl} category={p.category} /></span>
            <span className="mt-1 block truncate text-xs group-hover:text-link-hover">{p.name}</span>
            <span className="num block text-xs font-bold">{ghs(gbpToGhsMinor(p.priceMinor, shopper.fx))}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
  const card = "rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(16,20,18,0.14)] flex flex-col gap-3";
  const tint = "rounded-2xl p-4 shadow-[0_1px_3px_rgba(16,20,18,0.14)] flex flex-col gap-3";
  const trending = [...deals, ...featured, ...arrivals].filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i).slice(0, 16);

  return (
    <>
      <section className="mx-auto max-w-[90rem] px-3 pt-3 md:px-4"><Carousel slides={slides} label="Featured offers" /></section>

      <section id="paste-link" aria-labelledby="paste-h" className="mx-auto mt-3 max-w-[90rem] scroll-mt-40 px-3 md:px-4">
        <div className="relative isolate overflow-hidden rounded-2xl border-4 border-cta bg-[color-mix(in_srgb,var(--cta)_22%,white)] p-5 shadow-[0_6px_0_var(--navy)] md:p-8">
          <span className="float-slow absolute -right-10 -top-10 -z-10 h-44 w-44 rounded-full bg-cta/50" aria-hidden="true" />
          <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr] lg:items-center">
            <div>
              <p className="inline-block rounded-full bg-navy px-3 py-1 text-xs font-bold uppercase tracking-wide text-spark">The easiest way to shop</p>
              <h2 id="paste-h" className="mt-2 text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold leading-tight">Found it on a UK website? Paste the link.</h2>
              <p className="mt-2 max-w-xl text-base text-ink-soft">Works with any UK shop: Amazon, Argos, Next, Tesco, Currys, M&amp;S, B&amp;Q and more. <Link href="/amazon" className="link font-semibold">Ordering from Amazon UK?</Link> We check the price, quote the full cost in pounds and cedis, and buy it once you pay.</p>
              <ol className="mt-4 grid gap-2 text-sm font-semibold sm:grid-cols-3">
                {["Paste the link", "Get your price in cedis", "Pay, we ship to Ghana"].map((t, i) => (
                  <li key={t} className="flex items-center gap-2"><span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy text-spark">{i + 1}</span>{t}</li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(16,20,18,0.2)] md:p-5">
              <LinkFinder big />
              <p className="mt-3 text-xs text-ink-soft">Not sure where to find the link? Open the product on the shop&rsquo;s website, then copy the address from your browser&rsquo;s address bar.</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Quick picks" className="mx-auto mt-4 grid max-w-[90rem] gap-3 px-3 sm:grid-cols-2 md:px-4 xl:grid-cols-4">
        {shopper.customer ? (
          <div className={card}>
            <h2 className="text-xl font-bold">Hi, {shopper.customer.name.split(" ")[0]}</h2>
            {latestOpen ? (
              <>
                <p className="text-sm"><span className="mono font-bold">{latestOpen.number}</span><br />{STATUS_LABEL[latestOpen.status]}</p>
                <StatusTracker status={latestOpen.status} compact />
                <Link href={`/account/orders/${latestOpen.number}`} className="btn btn-small btn-primary mt-auto w-fit">Track this order</Link>
              </>
            ) : (
              <p className="text-sm text-ink-soft">Your orders and tracking live in your account.</p>
            )}
            <Link href="/account/orders" className="link mt-auto text-sm">All orders ›</Link>
          </div>
        ) : (
          <div className={card}>
            <h2 className="text-xl font-bold">Sign in for the best experience</h2>
            <ul className="grid gap-1 text-sm text-ink-soft">
              <li>✓ Track every order</li>
              <li>✓ Save items and addresses</li>
              <li>✓ Check out in seconds</li>
            </ul>
            <Link href="/login" className="btn btn-gold mt-auto">Sign in</Link>
            <Link href="/register" className="link text-center text-sm">New customer? Start here.</Link>
          </div>
        )}
        {deals.length > 0 ? (
        <div className={`${tint} bg-[color-mix(in_srgb,var(--cta)_18%,white)]`}>
          <h2 className="text-xl font-bold">Today&rsquo;s deals</h2>
          {mini(deals)}
          <Link href="/search?deals=1&sort=discount" className="link mt-auto text-sm">See all deals ›</Link>
        </div>
        ) : (
          <div className={`${tint} bg-[color-mix(in_srgb,var(--cta)_18%,white)]`}>
            <h2 className="text-xl font-bold">We&rsquo;re stocking the shelves</h2>
            <p className="text-sm text-ink-soft">Listings from UK sellers are being added. In the meantime, you can still get anything from a UK shop.</p>
            <Link href="/request" className="btn btn-gold mt-auto w-fit">Request an item by link</Link>
          </div>
        )}
        <div className={card}>
          <h2 className="text-xl font-bold">Shop by department</h2>
          <ul className="grid grid-cols-2 gap-3">
            {departments.slice(0, 4).map((d) => (
              <li key={d.slug}>
                <Link href={`/department/${d.slug}`} className="lift group relative flex aspect-square flex-col justify-between overflow-hidden rounded p-2 text-white" style={{ background: d.accent }}>
                  <span className="text-sm font-bold leading-tight">{d.name}</span>
                  <span className="pointer-events-none absolute inset-x-0 top-[34%] flex justify-center opacity-90 transition-transform duration-300 group-hover:scale-110">
                    <DepartmentIcon name={d.name} className="h-14 w-14" />
                  </span>
                  <span className="num relative text-xs opacity-90">{d.products} items</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/shops" className="link mt-auto text-sm">See all shops ›</Link>
        </div>
        {arrivals.length > 0 && (
        <div className={`${tint} bg-blue-soft`}>
          <h2 className="text-xl font-bold">New arrivals</h2>
          {mini(arrivals)}
          <Link href="/search?sort=newest" className="link mt-auto text-sm">See what&rsquo;s new ›</Link>
        </div>
        )}
      </section>

      {trending.length > 0 && (
      <section aria-label="Trending now" className="mx-auto mt-4 max-w-[90rem] px-3 md:px-4">
        <Reveal>
          <div className="overflow-hidden rounded-2xl bg-white py-4 shadow-[0_1px_3px_rgba(16,20,18,0.12)]">
            <h2 className="flex items-center gap-2 px-4 pb-3 text-xl font-bold md:px-5"><span className="h-5 w-1.5 rounded-full bg-cta" aria-hidden="true" /> Trending now</h2>
            <Marquee label="Trending items" seconds={60}>
              {trending.map((p) => (
                <li key={p.id} className="w-60 shrink-0">
                  <Link href={`/products/${p.slug}`} className="lift flex items-center gap-3 rounded-xl border border-line bg-white p-2">
                    <span className="block w-16 shrink-0 overflow-hidden rounded"><ProductArt name={p.name} accent={p.shopAccent} imageUrl={p.imageUrl} category={p.category} /></span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm leading-snug">{p.name}</span>
                      <span className="num block text-sm font-bold">{ghs(gbpToGhsMinor(p.priceMinor, shopper.fx))}</span>
                      <span className="num block text-xs text-ink-soft">{gbp(p.priceMinor)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </Marquee>
          </div>
        </Reveal>
      </section>

      )}

      <section aria-label="Why shop here" className="mx-auto mt-4 max-w-[90rem] px-3 md:px-4">
        <Reveal>
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line md:grid-cols-4">
            {TRUST.map(([t, sub]) => (
              <li key={t} className="flex gap-3 bg-white p-4">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green text-xs font-bold text-white" aria-hidden="true">✓</span>
                <span><span className="block font-bold">{t}</span><span className="text-sm text-ink-soft">{sub}</span></span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <ProductShelf id="deals" title="Today's deals" subtitle={nextEnd ? <>Next deal ends in <Countdown endsAt={nextEnd} className="font-bold text-red" /></> : "Real savings on UK favourites"} products={deals} shopper={shopper} href="/search?deals=1&sort=discount" countdown accent />
      <ProductShelf id="best" title={bestIsReal ? "Best sellers" : "Top picks"} subtitle={bestIsReal ? "What other shoppers bought in the last 30 days" : "A selection to get you started"} products={featured} shopper={shopper} href="/search?sort=rating" />
      {again.length > 0 && <ProductShelf id="again" title="Buy it again" subtitle="From your past orders" products={again.slice(0, 12)} shopper={shopper} href="/account/orders" linkLabel="Your orders" />}

      <section aria-labelledby="shops-h" className="mx-auto mt-4 max-w-[90rem] px-3 md:px-4">
        <Reveal>
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(16,20,18,0.12)] md:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="shops-h" className="text-xl font-bold">Shop these UK stores</h2>
              <Link href="/shops" className="link text-sm">All shops ›</Link>
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {shops.map((s) => <li key={s.id}><ShopTile shop={s} /></li>)}
            </ul>
          </div>
        </Reveal>
      </section>

      <ProductShelf id="new" title="New arrivals" products={arrivals} shopper={shopper} href="/search?sort=newest" badge="new" />
      <RecentlyViewed />

      <section id="how" aria-labelledby="how-h" className="mx-auto mt-4 max-w-[90rem] scroll-mt-40 px-3 md:px-4">
        <Reveal>
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(16,20,18,0.12)] md:p-6">
            <h2 id="how-h" className="text-xl font-bold">How it works</h2>
            <ol className="mt-4 grid gap-4 md:grid-cols-4">
              {STEPS.map(([n, title, body]) => (
                <li key={n} className="rounded-lg border border-line p-4">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-blue text-sm font-bold text-white">{n}</span>
                  <h3 className="mt-3 text-base font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </section>
    </>
  );
}
