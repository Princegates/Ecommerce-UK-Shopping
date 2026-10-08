import Link from "next/link";
import { getSettings } from "@/lib/settings";

const PAY = ["Mobile Money", "Visa", "Mastercard", "Pay in GH₵", "Pay in £ at the shop"];

export default function Footer() {
  const { siteName, supportWhatsapp } = getSettings();
  const wa = supportWhatsapp.replace(/\D/g, "");
  const col = "grid content-start gap-1.5 text-sm";
  const a = "text-white/80 hover:text-white hover:underline";
  return (
    <footer className="mt-10 pb-16 text-white md:pb-0">
      <div className="strip" />
      <div className="bg-navy-2">
        <div className="mx-auto grid max-w-[90rem] gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <nav aria-label="Shop" className={col}>
            <p className="mb-1 text-base font-bold">Shop</p>
            <Link className={a} href="/shops">All shops</Link>
            <Link className={a} href="/search?deals=1&sort=discount">Today&rsquo;s deals</Link>
            <Link className={a} href="/search?sort=newest">New arrivals</Link>
            <Link className={a} href="/search">Search everything</Link>
          </nav>
          <nav aria-label="Your orders" className={col}>
            <p className="mb-1 text-base font-bold">Your orders</p>
            <Link className={a} href="/account/orders">My orders</Link>
            <Link className={a} href="/account/wishlist">Saved items</Link>
            <Link className={a} href="/track">Track an order</Link>
            <Link className={a} href="/cart">Cart</Link>
          </nav>
          <nav aria-label="Help" className={col}>
            <p className="mb-1 text-base font-bold">Help</p>
            <Link className={a} href="/request">Request an item by link</Link>
            <Link className={a} href="/#how">How it works</Link>
            {wa && <a className={a} href={`https://wa.me/${wa}`}>Chat on WhatsApp</a>}
          </nav>
          <div className={col}>
            <p className="mb-1 text-base font-bold">Good to know</p>
            <p className="text-white/80">Your total covers the items, our service charge, shipping to Ghana and delivery to your address. Prices are shown in pounds and cedis.</p>
            <p className="text-white/80">Import duty and taxes charged by customs, if any, are not included.</p>
          </div>
        </div>
      </div>
      <div className="bg-navy">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-4 px-4 py-6">
          <p className="text-xl font-bold">{siteName}</p>
          <ul className="flex flex-wrap items-center gap-2" aria-label="Ways to pay">
            {PAY.map((m) => <li key={m} className="rounded border border-white/30 px-2 py-1 text-xs text-white/85">{m}</li>)}
          </ul>
        </div>
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-3 px-4 pb-6 text-xs text-white/60">
          <div className="grid gap-1">
            <p>© {new Date().getFullYear()} {siteName}. Product names, photos and prices come from the sellers listed.</p>
            <p className="font-medium text-white/80">Powered by Anknovate IT Services</p>
            <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
              <Link className="text-white/80 hover:text-white hover:underline" href="/privacy">Privacy policy</Link>
              <Link className="text-white/80 hover:text-white hover:underline" href="/terms">Terms of service</Link>
              <Link className="text-white/80 hover:text-white hover:underline" href="/data-deletion">Delete your data</Link>
            </nav>
          </div>
          <Link href="/admin" rel="nofollow" className="rounded-lg border border-white/30 px-3 py-1.5 font-medium text-white/85 hover:bg-white/10 hover:text-white">Admin</Link>
        </div>
      </div>
    </footer>
  );
}
