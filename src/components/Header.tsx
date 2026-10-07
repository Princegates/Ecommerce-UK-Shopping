import Link from "next/link";
import { logoutAction } from "@/app/actions/account";
import { getCart, cartCount } from "@/lib/cart";
import { listDepartments, listShops } from "@/lib/catalog";
import { getCustomer } from "@/lib/customer-session";
import { unseenUpdateCount } from "@/lib/customers";
import { getDeliveryContext } from "@/lib/delivery-context";
import { effectiveRate } from "@/lib/pricing";
import { getSettings, getZones } from "@/lib/settings";
import { wishlistIds } from "@/lib/wishlist";
import BottomNav from "./shop/BottomNav";
import CartBump from "./shop/CartBump";
import LinkAdd from "./shop/LinkAdd";
import DeliverTo from "./shop/DeliverTo";
import Dropdown from "./shop/Dropdown";
import SearchBox from "./shop/SearchBox";

const heart = "M12 21s-7.500-4.600-9.600-9.200C.8 8.300 3 4.500 6.700 4.500c2 0 3.500 1 5.300 3 1.800-2 3.300-3 5.300-3 3.700 0 5.900 3.800 4.300 7.300C19.500 16.400 12 21 12 21z";

export default async function Header() {
  const settings = getSettings();
  const [customer, cart, ctx] = await Promise.all([getCustomer(), getCart(), getDeliveryContext()]);
  const count = cartCount(cart);
  const departments = listDepartments();
  const shops = listShops();
  const zones = getZones().map((z) => ({ id: z.id, name: z.name }));
  const rate = effectiveRate(settings.fx);
  const saved = customer ? wishlistIds(customer.id).size : 0;
  const unseen = customer ? unseenUpdateCount(customer.id) : 0;
  const first = customer?.name.split(" ")[0];

  const navLink = "inline-block whitespace-nowrap rounded-lg px-2 py-1.5 hover:bg-white/10";
  return (
    <>
      <header className="sticky top-0 z-40 text-white">
        <div className="bg-navy">
          <div className="mx-auto grid max-w-[90rem] grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-2 md:grid-cols-[auto_auto_minmax(0,1fr)_auto] md:px-4">
            <Link href="/" className="rounded-lg px-2 py-1 hover:bg-white/10" aria-label={`${settings.siteName} home`}>
              <span className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 rotate-45 place-items-center rounded-md bg-cta" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-navy" /></span>
                <span className="font-display text-base font-bold leading-none tracking-tight sm:text-lg md:text-xl">{settings.siteName}</span>
              </span>
            </Link>

            <div className="hidden lg:block">{ctx && <DeliverTo zones={zones} current={ctx.zoneId} />}</div>

            <div className="order-last col-span-3 md:order-none md:col-span-1">
              <SearchBox departments={departments.map((d) => ({ name: d.name, slug: d.slug }))} />
            </div>

            <div className="col-start-3 row-start-1 flex items-center gap-0.5 md:col-start-auto md:row-start-auto md:gap-1">
              <Dropdown
                align="right"
                className="grid cursor-pointer rounded-lg px-2 py-1 text-left leading-tight hover:bg-white/10"
                panelClassName="w-64 p-3"
                label={
                  <>
                    <span className="text-[0.7rem] text-white/80">{customer ? `Hello, ${first}` : "Hello, sign in"}</span>
                    <span className="hidden text-sm font-bold md:inline">Account ▾</span>
                    <span className="text-sm font-bold md:hidden">Account</span>
                  </>
                }
              >
                {customer ? (
                  <div className="grid gap-0.5 text-sm">
                    {([["/account", "Your account"], ["/account/orders", "Orders and tracking"], ["/account/updates", "Order updates"], ["/account/wishlist", "Saved items"], ["/account/addresses", "Addresses"], ["/account/profile", "Profile"], ["/account/security", "Security"]] as const).map(([href, label]) => (
                      <Link key={href} href={href} className="rounded px-2 py-1.5 hover:bg-blue-soft hover:text-link">{label}</Link>
                    ))}
                    <form action={logoutAction} className="mt-1 border-t border-line pt-2"><button className="btn btn-small w-full">Sign out</button></form>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <Link href="/login" className="btn btn-gold">Sign in</Link>
                    <p className="text-sm">New customer? <Link href="/register" className="link">Start here.</Link></p>
                    <p className="hint">Track orders, save items and check out faster.</p>
                  </div>
                )}
              </Dropdown>

              <Link href={customer ? "/account/orders" : "/track"} className="hidden rounded-lg px-2 py-1 leading-tight hover:bg-white/10 lg:block">
                <span className="block text-[0.7rem] text-white/80">Your</span>
                <span className="block text-sm font-bold">Orders</span>
              </Link>

              {customer && (
                <Link href="/account/updates" className="relative hidden rounded-lg p-2 hover:bg-white/10 sm:block" aria-label={unseen ? `${unseen} new order update${unseen === 1 ? "" : "s"}` : "Order updates"}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9a6 6 0 1112 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 004 0" /></svg>
                  {unseen > 0 && <span className="num absolute right-0.5 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-red px-1 text-[0.65rem] font-bold text-white">{unseen}</span>}
                </Link>
              )}

              <Link href={customer ? "/account/wishlist" : "/login?next=%2Faccount%2Fwishlist"} className="relative hidden rounded-lg p-2 hover:bg-white/10 sm:block" aria-label={saved ? `Saved items, ${saved}` : "Saved items"}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={heart} /></svg>
                {saved > 0 && <span className="num absolute right-0.5 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-orange px-1 text-[0.65rem] font-bold text-ink">{saved}</span>}
              </Link>

              <Link id="cart-link" href="/cart" className="relative ml-1 flex items-center gap-2 rounded-xl bg-cta px-3 py-2 text-ink hover:bg-[var(--cta-hover)]" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
                <span className="relative">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.500 11h11L21 7H6M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z" /></svg>
                  <span className="num absolute -right-2.5 -top-2.5 grid h-5 min-w-5 place-items-center rounded-full bg-navy px-1 text-[0.7rem] font-bold text-white">{count}</span>
                </span>
                <span className="hidden text-sm font-bold sm:inline">Cart</span>
              </Link>
            </div>
          </div>
        </div>

        <nav className="bg-navy-2" aria-label="Departments and offers">
          <div className="mx-auto flex max-w-[90rem] items-center gap-0.5 px-3 py-0.5 text-sm font-medium md:px-4">
            <Dropdown
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 font-bold hover:bg-white/10"
              panelClassName="w-[min(58rem,92vw)] p-5"
              label={<><span aria-hidden="true">☰</span> Browse</>}
            >
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                {departments.map((d) => (
                  <div key={d.slug}>
                    <Link href={`/department/${d.slug}`} className="text-base font-bold hover:text-link hover:underline">{d.name}</Link>
                    <ul className="mt-1 grid gap-0.5 text-sm">
                      {shops.filter((s) => s.category === d.name).slice(0, 4).map((s) => (
                        <li key={s.id}><Link href={`/shops/${s.slug}`} className="text-ink-soft hover:text-link hover:underline">{s.name}</Link></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-line pt-3 text-sm"><Link href="/shops" className="link font-bold">See every shop →</Link></p>
            </Dropdown>
            <ul className="flex flex-1 items-center gap-0.5 overflow-x-auto whitespace-nowrap">
              <li><Link href="/search?deals=1&sort=discount" className={`${navLink} font-bold text-spark`}>Today&rsquo;s Deals</Link></li>
              <li><Link href="/search?sort=newest" className={navLink}>New arrivals</Link></li>
              <li><Link href="/#best" className={navLink}>Best sellers</Link></li>
              {departments.slice(0, 6).map((d) => (
                <li key={d.slug} className="hidden xl:block"><Link href={`/department/${d.slug}`} className={navLink}>{d.name}</Link></li>
              ))}
              <li><Link href="/shops" className={navLink}>Shops</Link></li>
              <li className="ml-auto lg:hidden">{ctx && <DeliverTo zones={zones} current={ctx.zoneId} />}</li>
            </ul>
            <div className="shrink-0 pl-1"><LinkAdd /></div>
            <p className="num hidden shrink-0 pl-3 text-xs text-white/80 lg:block">£1 = <span className="font-bold text-spark">GH₵{rate.toFixed(2)}</span> · pay in cedis</p>
          </div>
        </nav>
      </header>
      <CartBump />
      <BottomNav cartCount={count} signedIn={Boolean(customer)} />
    </>
  );
}
