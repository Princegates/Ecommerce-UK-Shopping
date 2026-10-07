"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: [string, string][] = [
  ["/account", "Overview"],
  ["/account/orders", "Orders"],
  ["/account/updates", "Updates"],
  ["/account/wishlist", "Saved items"],
  ["/account/addresses", "Addresses"],
  ["/account/profile", "Profile"],
  ["/account/security", "Security"],
];

export default function AccountNav() {
  const path = usePathname();
  return (
    <nav aria-label="Account" className="-mx-4 flex snap-x scroll-px-4 gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:overflow-visible md:px-0">
      {ITEMS.map(([href, label]) => {
        const active = href === "/account" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`min-h-11 snap-start whitespace-nowrap border-2 px-4 py-2 font-semibold ${active ? "border-line bg-ink text-paper" : "border-transparent hover:border-line hover:bg-gold"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
