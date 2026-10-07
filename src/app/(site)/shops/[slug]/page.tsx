import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { getShop, listProducts, productCategoriesForShop, type ProductSort } from "@/lib/catalog";
import { getShopper } from "@/lib/shopper";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; sort?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shop = getShop((await params).slug);
  return { title: shop ? shop.name : "Shop not found" };
}

const SORTS: [ProductSort, string][] = [
  ["popular", "Popular"],
  ["price-asc", "Price: low to high"],
  ["price-desc", "Price: high to low"],
  ["name", "A to Z"],
];

export default async function ShopPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = getShop(slug);
  if (!shop) notFound();

  const categories = productCategoriesForShop(shop.id);
  const category = sp.category && categories.includes(sp.category) ? sp.category : undefined;
  const sort = (SORTS.find(([k]) => k === sp.sort)?.[0] ?? "popular") as ProductSort;
  const products = listProducts({ shopId: shop.id, category, sort });
  const shopper = await getShopper();

  const href = (next: { category?: string; sort?: string }) => {
    const q = new URLSearchParams();
    const c = "category" in next ? next.category : category;
    const s = "sort" in next ? next.sort : sort;
    if (c) q.set("category", c);
    if (s && s !== "popular") q.set("sort", s);
    const qs = q.toString();
    return `/shops/${shop.slug}${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <section className="border-b-2 border-ink" style={{ background: shop.accent, color: "#fff" }}>
        <div className="mx-auto max-w-7xl px-4 py-10">
          <nav aria-label="Breadcrumb" className="label !text-white/80">
            <Link href="/shops" className="hover:underline">Shops</Link> / {shop.category}
          </nav>
          <h1 className="mt-3 text-[clamp(2.4rem,6vw,4.4rem)]">{shop.name}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/90">{shop.description || shop.tagline}</p>
          <p className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="tag !bg-paper-3 !text-ink">{shop.productCount} items</span>
            <span className="tag !bg-paper-3 !text-ink">Item prices match the UK shop</span>
            {shop.websiteUrl && (
              <a href={shop.websiteUrl} target="_blank" rel="noopener noreferrer" className="link">
                Visit the shop&rsquo;s own website ↗
              </a>
            )}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
            <Link href={href({ category: undefined })} aria-current={!category ? "page" : undefined} className={`tag !px-3 !py-1.5 ${!category ? "!bg-ink !text-paper" : ""}`}>
              All
            </Link>
            {categories.map((c) => (
              <Link key={c} href={href({ category: c })} aria-current={category === c ? "page" : undefined} className={`tag !px-3 !py-1.5 ${category === c ? "!bg-ink !text-paper" : ""}`}>
                {c}
              </Link>
            ))}
          </nav>
          <nav aria-label="Sort" className="flex flex-wrap items-center gap-2">
            <span className="label">Sort</span>
            {SORTS.map(([k, label]) => (
              <Link key={k} href={href({ sort: k })} aria-current={sort === k ? "page" : undefined} className={`text-sm ${sort === k ? "font-bold underline decoration-2 underline-offset-4" : "link"}`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {products.length === 0 ? (
          <p className="mt-10">Nothing here yet.</p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} fx={shopper.fx} ctx={shopper.ctx} saved={shopper.saved.has(p.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
