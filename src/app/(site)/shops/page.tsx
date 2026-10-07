import type { Metadata } from "next";
import Link from "next/link";
import ShopTile from "@/components/ShopTile";
import { listShops, shopCategories } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UK shops" };

export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const categories = shopCategories();
  const active = category && categories.includes(category) ? category : undefined;
  const shops = listShops({ category: active });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="label">Directory</p>
      <h1 className="text-5xl">UK shops</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Every shop below is one we can buy from. Open a shop, add items to your cart, and pay us once in cedis.
      </p>

      <nav aria-label="Filter shops by category" className="mt-8 flex flex-wrap gap-2">
        <Link href="/shops" aria-current={!active ? "page" : undefined} className={`tag !px-3 !py-1.5 ${!active ? "!bg-ink !text-paper" : ""}`}>
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c}
            href={`/shops?category=${encodeURIComponent(c)}`}
            aria-current={active === c ? "page" : undefined}
            className={`tag !px-3 !py-1.5 ${active === c ? "!bg-ink !text-paper" : ""}`}
          >
            {c}
          </Link>
        ))}
      </nav>

      {shops.length === 0 ? (
        <p className="mt-10">No shops in this category yet.</p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shops.map((s) => (
            <li key={s.id}>
              <ShopTile shop={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
