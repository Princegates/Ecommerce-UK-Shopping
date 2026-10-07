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
    <nav aria-label="Account" className="flex gap-1 overflow-x-auto md:grid md:overflow-visible">
      {ITEMS.map(([href, label]) => {
        const active = href === "/account" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-2 px-4 py-2 font-semibold ${active ? "border-ink bg-ink text-paper" : "border-transparent hover:border-ink hover:bg-gold"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
