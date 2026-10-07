"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icon = (d: string) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

/** Thumb-reach navigation for phones. */
export default function BottomNav({ cartCount, signedIn }: { cartCount: number; signedIn: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Home", d: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
    { href: "/shops", label: "Shops", d: "M3 9l2-5h14l2 5M4 9v11h16V9M9 20v-6h6v6" },
    { href: "/request", label: "Paste link", d: "M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" },
    { href: "/cart", label: "Cart", d: "M3 4h2l2.500 11h11L21 7H6M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z", badge: cartCount },
    { href: signedIn ? "/account" : "/login", label: signedIn ? "Account" : "Sign in", d: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" },
  ];
  return (
    <nav className="tabbar md:hidden" aria-label="Main">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link key={it.label} href={it.href} aria-current={active ? "page" : undefined} className={`relative grid justify-items-center gap-0.5 py-2 text-[0.7rem] font-bold ${active ? "text-blue" : "text-ink-soft"}`}>
            {icon(it.d)}
            {it.label}
            {it.badge ? <span className="num absolute right-[28%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange px-1 text-[0.65rem] text-ink">{it.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
