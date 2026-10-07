import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { PAGE_SIZE, SORTS, browseHref, parseBrowse, toQuery, without, type BrowseParams } from "@/lib/browse";
import { listDepartments, queryProducts } from "@/lib/catalog";
import { ghs } from "@/lib/money";
import { gbpToGhsMinor } from "@/lib/pricing";
import type { Shopper } from "@/lib/shopper";

type Raw = Record<string, string | string[] | undefined>;

/**
 * The listing used by search and department pages: a filter sidebar (a plain GET form, so it works
 * without JavaScript), active-filter chips, sorting and paging.
 */
export default function BrowseView({
  basePath, searchParams, shopper, fixedDepartment, heading, intro,
}: {
  basePath: string;
  searchParams: Raw;
  shopper: Shopper;
  /** Department locked by the page, such as /department/fashion. */
  fixedDepartment?: string;
  heading: string;
  intro?: React.ReactNode;
}) {
  const p = parseBrowse(searchParams);
  const departments = listDepartments();
  const names = new Map(departments.map((d) => [d.slug, d.name]));
  const { items, total, facets } = queryProducts(toQuery(p, shopper.fx, names, fixedDepartment ? [fixedDepartment] : undefined));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (patch: Partial<BrowseParams>) => browseHref(basePath, p, patch);
  const fx = shopper.fx;

  const chips: { label: string; to: string }[] = [];
  if (p.q) chips.push({ label: `“${p.q}”`, to: href({ q: "" }) });
  if (!fixedDepartment) for (const s of p.d) chips.push({ label: names.get(s) ?? s, to: href({ d: without(p.d, s) }) });
  for (const s of p.shop) chips.push({ label: facets.shops.find((x) => x.slug === s)?.name ?? s, to: href({ shop: without(p.shop, s) }) });
  for (const c of p.cat) chips.push({ label: c, to: href({ cat: without(p.cat, c) }) });
  if (p.min || p.max) chips.push({ label: `GH₵${p.min || "0"} – ${p.max ? `GH₵${p.max}` : "any"}`, to: href({ min: "", max: "" }) });
  if (p.deals) chips.push({ label: "Deals only", to: href({ deals: false }) });

  const filters = (
    <form method="get" action={basePath} className="grid gap-6">
      {p.q && <input type="hidden" name="q" value={p.q} />}
      {p.sort !== "popular" && <input type="hidden" name="sort" value={p.sort} />}

      {!fixedDepartment && facets.departments.length > 1 && (
        <fieldset>
          <legend className="label mb-1 text-ink">Department</legend>
          {facets.departments.map((d) => {
            const slug = departments.find((x) => x.name === d.name)?.slug ?? d.name;
            return (
              <label key={d.name} className="check text-sm">
                <input type="checkbox" name="d" value={slug} defaultChecked={p.d.includes(slug)} />
                <span className="flex-1">{d.name}</span><span className="label num">{d.count}</span>
              </label>
            );
          })}
        </fieldset>
      )}

      {facets.shops.length > 0 && (
        <fieldset>
          <legend className="label mb-1 text-ink">Shop</legend>
          {facets.shops.map((s) => (
            <label key={s.slug} className="check text-sm">
              <input type="checkbox" name="shop" value={s.slug} defaultChecked={p.shop.includes(s.slug)} />
              <span className="flex-1">{s.name}</span><span className="label num">{s.count}</span>
            </label>
          ))}
        </fieldset>
      )}

      {facets.categories.length > 0 && (
        <fieldset>
          <legend className="label mb-1 text-ink">Type</legend>
          {facets.categories.slice(0, 14).map((c) => (
            <label key={c.name} className="check text-sm">
              <input type="checkbox" name="cat" value={c.name} defaultChecked={p.cat.includes(c.name)} />
              <span className="flex-1">{c.name}</span><span className="label num">{c.count}</span>
            </label>
          ))}
        </fieldset>
      )}

      <fieldset>
        <legend className="label mb-1 text-ink">Price (GH₵)</legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="min">Lowest price in cedis</label>
          <input id="min" name="min" inputMode="decimal" className="input !min-h-10" placeholder={String(Math.floor(gbpToGhsMinor(facets.priceMinGbp, fx) / 100))} defaultValue={p.min} />
          <span aria-hidden="true">–</span>
          <label className="sr-only" htmlFor="max">Highest price in cedis</label>
          <input id="max" name="max" inputMode="decimal" className="input !min-h-10" placeholder={String(Math.ceil(gbpToGhsMinor(facets.priceMaxGbp, fx) / 100))} defaultValue={p.max} />
        </div>
      </fieldset>

      <label className="check font-semibold"><input type="checkbox" name="deals" value="1" defaultChecked={p.deals} /> Deals only</label>

      <div className="flex gap-3">
        <button className="btn btn-primary btn-small">Apply</button>
        <Link href={fixedDepartment || !p.q ? basePath : `${basePath}?q=${encodeURIComponent(p.q)}`} className="btn btn-small">Clear</Link>
      </div>
    </form>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="label"><Link href="/" className="hover:underline">Home</Link> / {heading}</nav>
      <h1 className="mt-2 text-2xl md:text-3xl">{heading}</h1>
      {intro && <div className="mt-2 max-w-2xl text-ink-soft">{intro}</div>}

      <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="Filters">
          <details className="lg:hidden box p-4"><summary className="cursor-pointer font-bold">Filters{chips.length ? ` (${chips.length})` : ""}</summary><div className="mt-4">{filters}</div></details>
          <div className="box box-shadow hidden p-5 lg:sticky lg:top-44 lg:block lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">{filters}</div>
        </aside>

        <section aria-label="Results">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold" role="status">{total} {total === 1 ? "item" : "items"}</p>
            <nav aria-label="Sort" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="label">Sort</span>
              {SORTS.map(([k, label]) => (
                <Link key={k} href={href({ sort: k })} aria-current={p.sort === k ? "true" : undefined} className={p.sort === k ? "font-bold underline decoration-2 underline-offset-4" : "link"}>{label}</Link>
              ))}
            </nav>
          </div>

          {chips.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.label}><Link href={c.to} className="tag !px-2.5 !py-1 hover:!bg-gold" aria-label={`Remove filter ${c.label}`}>{c.label} ✕</Link></li>
              ))}
            </ul>
          )}

          {items.length === 0 ? (
            <div className="box mt-8 p-8">
              <p className="display text-2xl">Nothing matches</p>
              <p className="mt-2 text-ink-soft">Try removing a filter, or send us the link to what you want and we will quote it.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {chips.length > 0 && <Link href={fixedDepartment ? basePath : p.q ? `${basePath}?q=${encodeURIComponent(p.q)}` : basePath} className="btn">Clear filters</Link>}
                <Link href="/request" className="btn btn-primary">Request an item by link</Link>
              </div>
            </div>
          ) : (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <li key={item.id}><ProductCard product={item} fx={fx} ctx={shopper.ctx} saved={shopper.saved.has(item.id)} countdown={p.deals} /></li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <nav aria-label="Pages" className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {p.page > 1 && <Link href={href({ page: p.page - 1 })} className="btn btn-small">← Previous</Link>}
              <span className="label num px-3">Page {p.page} of {pages}</span>
              {p.page < pages && <Link href={href({ page: p.page + 1 })} className="btn btn-small">Next →</Link>}
            </nav>
          )}
          {total > 0 && <p className="hint mt-6">Prices are shown in cedis at £1 = GH₵{(fx.rate * (1 + fx.markupPct / 100)).toFixed(2)}. {shopper.ctx && <>Delivered prices include service charge, shipping and delivery to {shopper.ctx.zoneName}; import duty, if any, is extra. Lowest price shown: {ghs(gbpToGhsMinor(facets.priceMinGbp, fx))}.</>}</p>}
        </section>
      </div>
    </div>
  );
}
