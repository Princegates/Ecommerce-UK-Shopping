import type { Metadata } from "next";
import Link from "next/link";
import { removeItemAction, updateQuantityAction } from "@/app/actions/cart";
import CartSummary from "@/components/CartSummary";
import ProductArt from "@/components/ProductArt";
import { getCart } from "@/lib/cart";
import { ghs } from "@/lib/money";
import { gbpToGhsMinor } from "@/lib/pricing";
import { getSettings, getShippingMethods, getZones } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your cart" };

export default async function CartPage() {
  const lines = await getCart();
  const settings = getSettings();

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="label">Your cart</p>
        <h1 className="mt-2 text-5xl">It&rsquo;s empty</h1>
        <p className="mx-auto mt-4 max-w-md text-ink-soft">
          Pick something from one of the UK shops and it will show up here with the full price to your door.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/shops" className="btn btn-primary">Browse the shops</Link>
          <Link href="/request" className="btn">Request an item by link</Link>
        </div>
      </div>
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="label">Step 1 of 3</p>
      <h1 className="text-5xl">Your cart</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <ul className="grid gap-4">
          {lines.map((l) => {
            const unit = gbpToGhsMinor(l.product.priceMinor, settings.fx);
            const lineTotal = gbpToGhsMinor(l.product.priceMinor * l.quantity, settings.fx);
            return (
              <li key={l.itemId} className="box box-shadow grid grid-cols-[6.5rem_1fr] sm:grid-cols-[9rem_1fr]">
                <div className="border-r-2 border-ink">
                  <ProductArt name={l.product.name} accent={l.product.shopAccent} imageUrl={l.product.imageUrl} />
                </div>
                <div className="grid gap-3 p-4">
                  <div>
                    <p className="label">{l.product.shopName}</p>
                    <Link href={`/products/${l.product.slug}`} className="display text-xl hover:underline">
                      {l.product.name}
                    </Link>
                    {Object.keys(l.options).length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {Object.entries(l.options).map(([k, v]) => (
                          <span key={k} className="tag">{k}: {v}</span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <form action={updateQuantityAction} className="inline-flex border-2 border-ink bg-paper-3">
                      <input type="hidden" name="itemId" value={l.itemId} />
                      <button name="quantity" value={l.quantity - 1} className="h-10 w-10 text-lg font-bold hover:bg-gold" aria-label={`Decrease quantity of ${l.product.name}`}>
                        −
                      </button>
                      <output className="num grid h-10 w-12 place-items-center border-x-2 border-ink font-semibold">{l.quantity}</output>
                      <button name="quantity" value={l.quantity + 1} className="h-10 w-10 text-lg font-bold hover:bg-gold" aria-label={`Increase quantity of ${l.product.name}`}>
                        +
                      </button>
                    </form>
                    <div className="text-right">
                      <p className="num display text-xl">{ghs(lineTotal)}</p>
                      {l.quantity > 1 && <p className="label num">{ghs(unit)} each</p>}
                    </div>
                  </div>
                  <form action={removeItemAction}>
                    <input type="hidden" name="itemId" value={l.itemId} />
                    <button className="link text-sm text-red">Remove</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>

        <CartSummary items={items} cfg={cfg} minOrderGbpMinor={settings.minOrderGbpMinor} />
      </div>
    </div>
  );
}
