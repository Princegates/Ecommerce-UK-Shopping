import Link from "next/link";
import type { Shop } from "@/lib/catalog";
import ShopLogo from "./ShopLogo";

export default function ShopTile({ shop }: { shop: Shop }) {
  return (
    <Link href={`/shops/${shop.slug}`} className="group lift flex h-full gap-3 rounded-lg border border-line bg-white p-3">
      <span className="transition-transform group-hover:scale-110"><ShopLogo shop={shop} className="h-14 w-14 text-xl" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold group-hover:text-link-hover">{shop.name}</span>
        <span className="block truncate text-sm text-ink-soft">{shop.tagline}</span>
        <span className="mt-1 flex items-center gap-2 text-xs">
          <span className="tag">{shop.category}</span>
          <span className="num text-ink-soft">{shop.productCount} items</span>
        </span>
      </span>
    </Link>
  );
}
