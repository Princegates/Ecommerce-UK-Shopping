import Link from "next/link";
import { getSettings } from "@/lib/settings";

export default function Footer() {
  const { siteName, supportWhatsapp } = getSettings();
  const wa = supportWhatsapp.replace(/\D/g, "");
  return (
    <footer className="mt-20 pb-16 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 pb-8 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Full price upfront", "Items, service charge, shipping and delivery shown before you pay."],
          ["Pay in cedis", "Mobile Money and cards. No UK card needed."],
          ["Tracked to your door", "Updates by SMS, WhatsApp, email and on your account."],
          ["We buy it for you", "No UK address needed. We order, ship and deliver."],
        ].map(([t, d]) => (
          <div key={t} className="box p-4">
            <p className="display text-lg">{t}</p>
            <p className="mt-1 text-sm text-ink-soft">{d}</p>
          </div>
        ))}
      </div>
      <div className="strip" />
      <div className="bg-ink text-paper">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="display text-3xl">{siteName}</p>
            <p className="mt-3 max-w-sm text-paper/75">
              We buy from UK shops for you, ship to Ghana and deliver to your door. One site, one payment in cedis,
              one tracking page.
            </p>
          </div>
          <nav aria-label="Shop" className="grid content-start gap-2">
            <p className="label !text-gold">Shop</p>
            <Link className="link" href="/shops">All shops</Link>
            <Link className="link" href="/search">Search</Link>
            <Link className="link" href="/search?deals=1&sort=discount">Today&rsquo;s deals</Link>
            <Link className="link" href="/request">Request an item by link</Link>
          </nav>
          <nav aria-label="Orders" className="grid content-start gap-2">
            <p className="label !text-gold">Your order</p>
            <Link className="link" href="/cart">Cart</Link>
            <Link className="link" href="/account/orders">My orders</Link>
            <Link className="link" href="/account/wishlist">Wishlist</Link>
            <Link className="link" href="/track">Track an order</Link>
            {wa && <a className="link" href={`https://wa.me/${wa}`}>Chat on WhatsApp</a>}
          </nav>
          <div className="grid content-start gap-2 text-sm text-paper/75">
            <p className="label !text-gold">Good to know</p>
            <p>Your total covers the items, our service charge, shipping to Ghana and delivery to your address.</p>
            <p>Import duty and taxes charged by customs, if any, are not included.</p>
          </div>
        </div>
        <div className="border-t border-paper/20">
          <ul className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 pt-4" aria-label="Ways to pay">
            {["Mobile Money", "Visa", "Mastercard", "Card payments", "Pay in GH₵"].map((m) => (
              <li key={m} className="label border border-paper/40 px-2 py-1 !text-paper/80">{m}</li>
            ))}
          </ul>
          <p className="label mx-auto max-w-7xl px-4 py-4 !text-paper/60">
            © {new Date().getFullYear()} {siteName}. Shop names and prices shown are sample data until you replace them in the admin area.
          </p>
        </div>
      </div>
    </footer>
  );
}
