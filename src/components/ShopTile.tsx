import Link from "next/link";
import type { Shop } from "@/lib/catalog";

export default function ShopTile({ shop }: { shop: Shop }) {
  return (
    <Link
      href={`/shops/${shop.slug}`}
      className="group box box-shadow flex h-full flex-col transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2 p-3" style={{ background: shop.accent, color: "#fff" }}>
        <span className="tag !bg-paper-3 !text-ink">{shop.category}</span>
        <span className="mono text-xs opacity-90 num">{String(shop.productCount).padStart(2, "0")} items</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t-2 border-ink p-4">
        <h3 className="text-[1.65rem] group-hover:underline">{shop.name}</h3>
        <p className="text-ink-soft">{shop.tagline}</p>
        <p className="mt-auto pt-4 font-semibold">
          Browse the shop <span aria-hidden="true">→</span>
        </p>
      </div>
    </Link>
  );
}
