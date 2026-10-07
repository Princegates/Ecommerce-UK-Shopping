import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/catalog";
import type { Shopper } from "@/lib/shopper";
import Rail from "./Rail";
import Reveal from "./Reveal";

/** A white panel holding a titled, scrollable row of product cards, like a department shelf. */
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
    <section id={id} aria-labelledby={`${id ?? title}-h`} className="mx-auto mt-4 max-w-[90rem] scroll-mt-40 px-3 md:px-4">
      <Reveal>
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(16,20,18,0.12)] md:p-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 id={`${id ?? title}-h`} className="flex items-center gap-2 text-xl font-bold md:text-[1.35rem]">
              <span className="h-5 w-1.5 rounded-full bg-cta" aria-hidden="true" />
              {accent && <span className="live-dot" aria-hidden="true" />}
              {title}
            </h2>
            {subtitle && <p className="text-sm text-ink-soft">{subtitle}</p>}
            {href && <Link href={href} className="link ml-auto text-sm">{linkLabel} ›</Link>}
          </div>
          <div className="mt-3">
            <Rail label={title}>
              {products.map((p) => (
                <li key={p.id} className="w-44 sm:w-52">
                  <ProductCard product={p} fx={shopper.fx} ctx={shopper.ctx} saved={shopper.saved.has(p.id)} countdown={countdown} badge={badge} />
                </li>
              ))}
            </Rail>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
