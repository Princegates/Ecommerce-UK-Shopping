import type { Metadata } from "next";
import Link from "next/link";
import ShopLogo from "@/components/ShopLogo";
import { removeItemAction, updateQuantityAction } from "@/app/actions/cart";
import CartSummary from "@/components/CartSummary";
import ProductArt from "@/components/ProductArt";
import ProductShelf from "@/components/shop/ProductShelf";
import { getCart } from "@/lib/cart";
import { relatedProducts, featuredProducts, type Product } from "@/lib/catalog";
import { gbp, ghs } from "@/lib/money";
import { getShopper } from "@/lib/shopper";
import { gbpToGhsMinor } from "@/lib/pricing";
import { getSettings, getShippingMethods, getZones } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your cart" };

export default async function CartPage() {
  const lines = await getCart();
  const settings = getSettings();
  const shopper = await getShopper();

  if (lines.length === 0) {
    return (
      <>
      <div className="mx-auto max-w-3xl px-4 pt-20 text-center">
        <p className="label">Your cart</p>
        <h1 className="mt-2 text-3xl">It&rsquo;s empty</h1>
        <p className="mx-auto mt-4 max-w-md text-ink-soft">
          Pick something from one of the UK shops and it will show up here with the full price to your door.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/shops" className="btn btn-primary">Browse the shops</Link>
          <Link href="/search?deals=1&sort=discount" className="btn btn-gold">See today&rsquo;s deals</Link>
          <Link href="/request" className="btn">Request an item by link</Link>
        </div>
      </div>
      <ProductShelf title="Popular right now" products={featuredProducts(10)} shopper={shopper} href="/search" />
      </>
    );
  }

  const cfg = {
    fx: settings.fx,
    serviceFee: settings.serviceFee,
    methods: getShippingMethods().map((m) => ({ code: m.code, name: m.name, eta: m.eta, rateCard: m.rateCard })),
    zones: getZones().map((z) => ({ id: z.id, name: z.name, areas: z.areas, feeMinor: z.feeMinor, eta: z.eta })),
  };
  const items = lines.map((l) => ({
    id: String(l.itemId),
    unitPriceMinor: l.product.priceMinor,
    quantity: l.quantity,
    weightGrams: l.product.weightGrams,
  }));

  const itemsGbp = lines.reduce((n, l) => n + l.product.priceMinor * l.quantity, 0);
  const minGbp = settings.minOrderGbpMinor;
  const reached = itemsGbp >= minGbp;
  const pct = minGbp > 0 ? Math.min(100, Math.round((itemsGbp / minGbp) * 100)) : 100;

  const inCart = new Set(lines.map((l) => l.product.id));
  const picks: Product[] = [];
  for (const l of lines) {
    for (const r of relatedProducts(l.product, 6)) {
      if (!inCart.has(r.id) && !picks.some((x) => x.id === r.id)) picks.push(r);
    }
  }
  for (const f of featuredProducts(10)) {
    if (picks.length >= 10) break;
    if (!inCart.has(f.id) && !picks.some((x) => x.id === f.id)) picks.push(f);
  }

  return (
    <div className="mx-auto max-w-[90rem] px-3 py-4 md:px-4">
      {minGbp > 0 && (
        <div className="mb-3 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,17,17,0.12)]" role="status">
          <p className={`text-sm font-bold ${reached ? "text-green" : ""}`}>
            {reached
              ? "✓ You have reached the minimum order. You can check out."
              : `Add ${gbp(minGbp - itemsGbp)} (about ${ghs(gbpToGhsMinor(minGbp - itemsGbp, settings.fx))}) more of items to check out.`}
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-paper" aria-hidden>
            <div className={`h-full rounded-full transition-all duration-700 ${reached ? "bg-green" : "bg-spark"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,17,17,0.12)] md:p-6" aria-labelledby="cart-h">
          <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
            <h1 id="cart-h" className="text-2xl font-medium">Shopping cart</h1>
            <p className="hidden text-sm text-ink-soft sm:block">Price</p>
          </div>
          <ul>
            {lines.map((l) => {
              const unit = gbpToGhsMinor(l.product.priceMinor, settings.fx);
              const lineGbp = l.product.priceMinor * l.quantity;
              const lineTotal = gbpToGhsMinor(lineGbp, settings.fx);
              return (
                <li key={l.itemId} className="grid grid-cols-[6rem_1fr] gap-4 border-b border-line py-4 last:border-0 sm:grid-cols-[9rem_1fr_auto]">
                  <Link href={`/products/${l.product.slug}`} className="block overflow-hidden rounded-lg border border-line">
                    <ProductArt name={l.product.name} accent={l.product.shopAccent} imageUrl={l.product.imageUrl} category={l.product.category} />
                  </Link>
                  <div className="grid content-start gap-1.5">
                    <Link href={`/products/${l.product.slug}`} className="text-base font-medium leading-snug hover:text-link-hover">{l.product.name}</Link>
                    <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                      {l.product.shopLogoUrl && <ShopLogo shop={{ name: l.product.shopName, accent: l.product.shopAccent, logoUrl: l.product.shopLogoUrl }} className="h-5 w-5 text-[10px]" />}
                      Sold by {l.product.shopName}
                    </p>
                    <p className="text-xs font-bold text-green">Available · we buy it from the UK shop for you</p>
                    {Object.keys(l.options).length > 0 && (
                      <p className="flex flex-wrap gap-1.5 text-xs">
                        {Object.entries(l.options).map(([k, v]) => (
                          <span key={k}><span className="font-bold">{k}:</span> {v}</span>
                        ))}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <form action={updateQuantityAction} className="inline-flex overflow-hidden rounded-full border border-[#888c8c] bg-paper-2">
                        <input type="hidden" name="itemId" value={l.itemId} />
                        <button name="quantity" value={l.quantity - 1} className="h-8 w-9 text-lg font-bold hover:bg-blue-soft" aria-label={`Decrease quantity of ${l.product.name}`}>
                          −
                        </button>
                        <output className="num grid h-8 w-10 place-items-center border-x border-[#888c8c] bg-white text-sm font-bold">{l.quantity}</output>
                        <button name="quantity" value={l.quantity + 1} className="h-8 w-9 text-lg font-bold hover:bg-blue-soft" aria-label={`Increase quantity of ${l.product.name}`}>
                          +
                        </button>
                      </form>
                      <span className="text-line" aria-hidden="true">|</span>
                      <form action={removeItemAction}>
                        <input type="hidden" name="itemId" value={l.itemId} />
                        <button className="link text-xs">Delete</button>
                      </form>
                    </div>
                  </div>
                  <div className="col-span-2 text-right sm:col-span-1">
                    <p className="num text-lg font-bold">{ghs(lineTotal)}</p>
                    <p className="num text-sm text-ink-soft">{gbp(lineGbp)}</p>
                    {l.quantity > 1 && <p className="num text-xs text-ink-soft">{ghs(unit)} each</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line pt-3 text-right text-sm">
            Items ({lines.reduce((n, l) => n + l.quantity, 0)}): <span className="num font-bold">{ghs(gbpToGhsMinor(itemsGbp, settings.fx))}</span>{" "}
            <span className="num text-ink-soft">({gbp(itemsGbp)})</span>
          </p>
        </section>

        <CartSummary items={items} cfg={cfg} minOrderGbpMinor={settings.minOrderGbpMinor} />
      </div>

      <div className="-mx-3 md:-mx-4">
        <ProductShelf id="cart-picks" title="You might also like" products={picks} shopper={shopper} />
      </div>
    </div>
  );
}
