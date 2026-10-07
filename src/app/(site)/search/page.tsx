import type { Metadata } from "next";
import ProductCard from "@/components/ProductCard";
import ShopTile from "@/components/ShopTile";
import { listProducts, listShops } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const settings = getSettings();
  const products = q ? listProducts({ q, limit: 60 }) : [];
  const needle = q.toLowerCase();
  const shops = q
    ? listShops().filter((s) => `${s.name} ${s.category} ${s.tagline}`.toLowerCase().includes(needle))
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="label">Search</p>
      <h1 className="text-5xl">{q ? <>Results for &ldquo;{q}&rdquo;</> : "Search the shops"}</h1>

      <form action="/search" role="search" className="mt-6 flex max-w-xl">
        <label htmlFor="search-q" className="sr-only">Search</label>
        <input id="search-q" name="q" defaultValue={q} className="input !border-r-0" placeholder="Try “trainers” or “laptop”" />
        <button className="btn btn-primary !shadow-none">Search</button>
      </form>

      {q && shops.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl">Shops</h2>
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {shops.map((s) => (
              <li key={s.id}>
                <ShopTile shop={s} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {q && (
        <section className="mt-10">
          <h2 className="text-2xl">Items {products.length > 0 && <span className="label ml-2">{products.length} found</span>}</h2>
          {products.length === 0 ? (
            <p className="mt-4 max-w-xl">
              Nothing matched. You can <a className="link font-semibold" href="/request">send us the link</a> to any UK product and we will quote it.
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} fx={settings.fx} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
