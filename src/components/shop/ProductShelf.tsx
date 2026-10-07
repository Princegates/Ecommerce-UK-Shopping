import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/catalog";
import type { Shopper } from "@/lib/shopper";
import Rail from "./Rail";

/** A titled, scrollable row of product cards. */
export default function ProductShelf({
  id, title, subtitle, products, shopper, href, linkLabel = "See all", countdown, badge, accent,
}: {
  id?: string;
  title: string;
  subtitle?: React.ReactNode;
  products: Product[];
  shopper: Shopper;
  href?: string;
  linkLabel?: string;
  countdown?: boolean;
  badge?: "new";
  accent?: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section id={id} aria-labelledby={`${id ?? title}-h`} className="mx-auto max-w-7xl scroll-mt-40 px-4 pt-14">
      <div className={`flex flex-wrap items-end justify-between gap-3 ${accent ? "border-l-8 border-red pl-4" : ""}`}>
        <div>
          <h2 id={`${id ?? title}-h`} className="text-3xl md:text-4xl">{title}</h2>
          {subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
        </div>
        {href && <Link href={href} className="link font-bold">{linkLabel} →</Link>}
      </div>
      <div className="mt-5">
        <Rail label={title}>
          {products.map((p) => (
            <li key={p.id} className="w-56 sm:w-60">
              <ProductCard product={p} fx={shopper.fx} ctx={shopper.ctx} saved={shopper.saved.has(p.id)} countdown={countdown} badge={badge} />
            </li>
          ))}
        </Rail>
      </div>
    </section>
  );
}
