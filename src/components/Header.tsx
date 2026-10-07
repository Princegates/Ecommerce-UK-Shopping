import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getCart, cartCount } from "@/lib/cart";
import { shopCategories } from "@/lib/catalog";
import { effectiveRate } from "@/lib/pricing";

export default async function Header() {
  const settings = getSettings();
  const cart = await getCart();
  const count = cartCount(cart);
  const categories = shopCategories();
  const rate = effectiveRate(settings.fx);

  return (
    <header className="sticky top-0 z-40 bg-paper">
      <div className="bg-ink text-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5">
          <p className="label !text-paper/80 num">
            £1 = <span className="!text-gold">GH₵{rate.toFixed(2)}</span>
            <span className="hidden sm:inline"> · pay in cedis · tracked to your door</span>
          </p>
          <nav className="label flex gap-4 !text-paper/80" aria-label="Quick links">
            <Link href="/track" className="hover:!text-gold">Track order</Link>
            <Link href="/request" className="hover:!text-gold">Request by link</Link>
          </nav>
        </div>
      </div>

      <div className="border-b-2 border-ink bg-paper">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/" className="group flex items-baseline gap-2" aria-label={`${settings.siteName} home`}>
            <span className="display text-3xl leading-none">{settings.siteName}</span>
            <span className="tag tag-gold -translate-y-1 group-hover:rotate-2">UK → GH</span>
          </Link>

          <form action="/search" role="search" className="order-3 flex w-full min-w-0 flex-1 md:order-none md:w-auto">
            <label htmlFor="q" className="sr-only">Search products and shops</label>
            <input
              id="q"
              name="q"
              type="search"
              placeholder="Search trainers, laptops, skincare…"
              className="input !border-r-0"
              autoComplete="off"
            />
            <button className="btn btn-primary !shadow-none" type="submit">Search</button>
          </form>

          <Link href="/cart" className="btn ml-auto md:ml-0" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
            Cart
            <span className="num grid h-6 min-w-6 place-items-center bg-ink px-1 text-sm text-paper">{count}</span>
          </Link>
        </div>

        <nav className="border-t-2 border-ink bg-paper-2" aria-label="Categories">
          <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5 text-sm font-semibold whitespace-nowrap">
            <li><Link href="/shops" className="inline-block px-3 py-1 hover:bg-gold">All shops</Link></li>
            {categories.map((c) => (
              <li key={c}>
                <Link href={`/shops?category=${encodeURIComponent(c)}`} className="inline-block px-3 py-1 hover:bg-gold">
                  {c}
                </Link>
              </li>
            ))}
            <li className="ml-auto"><Link href="/#how" className="inline-block px-3 py-1 hover:bg-gold">How it works</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
