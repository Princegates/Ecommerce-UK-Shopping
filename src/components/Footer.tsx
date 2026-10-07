import Link from "next/link";
import { getSettings } from "@/lib/settings";

export default function Footer() {
  const { siteName, supportWhatsapp } = getSettings();
  const wa = supportWhatsapp.replace(/\D/g, "");
  return (
    <footer className="mt-20">
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
            <Link className="link" href="/request">Request an item by link</Link>
          </nav>
          <nav aria-label="Orders" className="grid content-start gap-2">
            <p className="label !text-gold">Your order</p>
            <Link className="link" href="/cart">Cart</Link>
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
          <p className="label mx-auto max-w-7xl px-4 py-4 !text-paper/60">
            © {new Date().getFullYear()} {siteName}. Shop names and prices shown are sample data until you replace them in the admin area.
          </p>
        </div>
      </div>
    </footer>
  );
}
