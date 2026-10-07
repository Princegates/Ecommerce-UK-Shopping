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

  return (
    <>
      <header>
        <div className="bg-ink text-paper">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5">
            <p className="label num !text-paper/80">
              £1 = <span className="!text-gold">GH₵{rate.toFixed(2)}</span>
              <span className="hidden sm:inline"> · pay in cedis · tracked to your door</span>
            </p>
            <nav className="label flex gap-4 !text-paper/80" aria-label="Quick links">
              <Link href="/track" className="hover:!text-gold">Track order</Link>
              <Link href="/request" className="hover:!text-gold">Request by link</Link>
            </nav>
          </div>
        </div>

        <div className="sticky top-0 z-40 border-b-2 border-ink bg-paper md:h-[4.5rem]">
          <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-2.5 md:h-full md:grid-cols-[auto_auto_minmax(0,1fr)_auto] md:py-0">
            <Link href="/" className="group flex items-baseline gap-2" aria-label={`${settings.siteName} home`}>
              <span className="display text-2xl leading-none md:text-3xl">{settings.siteName}</span>
              <span className="tag tag-gold hidden -translate-y-1 group-hover:rotate-2 sm:inline-block">UK → GH</span>
            </Link>

            <div className="hidden lg:block">{ctx && <DeliverTo zones={zones} current={ctx.zoneId} />}</div>

            <div className="order-last col-span-3 md:order-none md:col-span-1">
              <SearchBox departments={departments.map((d) => ({ name: d.name, slug: d.slug }))} />
            </div>

            <div className="col-start-3 row-start-1 flex items-center gap-1 md:col-start-auto md:row-start-auto md:gap-2">
              <Dropdown
                align="right"
                className="grid cursor-pointer px-2 py-1 text-left leading-tight hover:bg-gold"
                panelClassName="w-64 p-3"
                label={
                  <>
                    <span className="label !text-[0.65rem]">{customer ? `Hello, ${first}` : "Hello, sign in"}</span>
                    <span className="hidden text-sm font-bold md:inline">Account &amp; orders ▾</span>
                    <span className="text-sm font-bold md:hidden">Account</span>
                  </>
                }
              >
                {customer ? (
                  <div className="grid gap-1 text-sm font-semibold">
                    {([["/account", "Your account"], ["/account/orders", "Orders and tracking"], ["/account/updates", "Order updates"], ["/account/wishlist", "Saved items"], ["/account/addresses", "Addresses"], ["/account/profile", "Profile"], ["/account/security", "Security"]] as const).map(([href, label]) => (
                      <Link key={href} href={href} className="px-2 py-1.5 hover:bg-gold">{label}</Link>
                    ))}
                    <form action={logoutAction} className="mt-1 border-t-2 border-dashed border-ink/30 pt-2"><button className="btn btn-small w-full">Sign out</button></form>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <Link href="/login" className="btn btn-primary">Sign in</Link>
                    <p className="text-sm">New customer? <Link href="/register" className="link font-semibold">Create an account</Link></p>
                    <p className="hint">Track orders, save items and check out faster.</p>
                  </div>
                )}
              </Dropdown>

              {customer && (
                <Link href="/account/updates" className="icon-btn relative hidden sm:grid" aria-label={unseen ? `${unseen} new order update${unseen === 1 ? "" : "s"}` : "Order updates"}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9a6 6 0 1112 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 004 0" /></svg>
                  {unseen > 0 && <span className="num absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center bg-red px-1 text-[0.7rem] font-bold text-white">{unseen}</span>}
                </Link>
              )}

              <Link href={customer ? "/account/wishlist" : "/login?next=%2Faccount%2Fwishlist"} className="icon-btn relative hidden sm:grid" aria-label={saved ? `Saved items, ${saved}` : "Saved items"}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={heart} /></svg>
                {saved > 0 && <span className="num absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center bg-ink px-1 text-[0.7rem] font-bold text-paper">{saved}</span>}
              </Link>

              <Link href="/cart" className="btn !min-h-10 !px-3" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.500 11h11L21 7H6M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z" /></svg>
                <span className="num grid h-6 min-w-6 place-items-center bg-ink px-1 text-sm text-paper">{count}</span>
              </Link>
            </div>
          </div>
        </div>

        <nav className="border-b-2 border-ink bg-paper-2 md:sticky md:top-[4.5rem] md:z-30" aria-label="Departments and offers">
          <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-1.5 text-sm font-bold">
            <Dropdown
              className="flex cursor-pointer items-center gap-2 bg-ink px-3 py-1.5 text-paper hover:bg-green"
              panelClassName="w-[min(58rem,92vw)] p-5"
              label={<><span aria-hidden="true">☰</span> All departments</>}
            >
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                {departments.map((d) => (
                  <div key={d.slug}>
                    <Link href={`/department/${d.slug}`} className="display text-lg hover:underline">{d.name}</Link>
                    <ul className="mt-1 grid gap-0.5 text-sm font-medium">
                      {shops.filter((s) => s.category === d.name).slice(0, 4).map((s) => (
                        <li key={s.id}><Link href={`/shops/${s.slug}`} className="text-ink-soft hover:text-ink hover:underline">{s.name}</Link></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t-2 border-dashed border-ink/30 pt-3 text-sm"><Link href="/shops" className="link font-bold">See every shop →</Link></p>
            </Dropdown>
            <ul className="flex flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap">
              <li><Link href="/search?deals=1&sort=discount" className="inline-block px-3 py-1.5 text-red hover:bg-gold hover:text-ink">Today&rsquo;s deals</Link></li>
              <li><Link href="/search?sort=newest" className="inline-block px-3 py-1.5 hover:bg-gold">New arrivals</Link></li>
              <li><Link href="/#best" className="inline-block px-3 py-1.5 hover:bg-gold">Best sellers</Link></li>
              {departments.slice(0, 5).map((d) => (
                <li key={d.slug} className="hidden xl:block"><Link href={`/department/${d.slug}`} className="inline-block px-3 py-1.5 hover:bg-gold">{d.name}</Link></li>
              ))}
              <li><Link href="/shops" className="inline-block px-3 py-1.5 hover:bg-gold">Shops</Link></li>
              <li><Link href="/request" className="inline-block px-3 py-1.5 hover:bg-gold">Request by link</Link></li>
              <li className="ml-auto lg:hidden">{ctx && <DeliverTo zones={zones} current={ctx.zoneId} />}</li>
            </ul>
          </div>
        </nav>
      </header>
      <BottomNav cartCount={count} signedIn={Boolean(customer)} />
    </>
  );
}

