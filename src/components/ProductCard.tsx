import Link from "next/link";
import type { Product } from "@/lib/catalog";
import type { DeliveryContext } from "@/lib/landed";
import { landedMinor } from "@/lib/landed";
import { gbp, ghs } from "@/lib/money";
import { ghsToGbpMinor, type FxConfig } from "@/lib/pricing";
import Price from "./Price";
import ProductArt from "./ProductArt";
import QuickAdd from "./shop/QuickAdd";
import Stars from "./shop/Stars";
import WishlistButton from "./shop/WishlistButton";

/**
 * A product tile. Prices appear in cedis and pounds, the rating shows when there are reviews, and the line under the price says
 * what it costs delivered. It makes no discount claims: no percentage-off tags, "was" prices or savings.
 */
export default function ProductCard({
  product, fx, ctx, saved = false, badge,
}: {
  product: Product;
  fx: FxConfig;
  ctx?: DeliveryContext | null;
  saved?: boolean;
  badge?: "new";
}) {
  const href = `/products/${product.slug}`;
  const door = ctx ? landedMinor(product, ctx) : null;

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(16,20,18,0.16)]">
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
          <ProductArt name={product.name} accent={product.shopAccent} imageUrl={product.imageUrl} category={product.category} />
        </Link>
        {badge === "new" && <span className="badge badge-new left-0 top-3 !rounded-l-none !rounded-r-md !py-1 !pl-2 !pr-2.5">New in</span>}
        <WishlistButton productId={product.id} saved={saved} className="absolute right-2 top-2 z-10" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 pt-1">
        <Link href={`/shops/${product.shopSlug}`} className="text-xs text-link hover:text-link-hover hover:underline">{product.shopName}</Link>
        <h3 className="!text-sm !font-normal !leading-snug">
          <Link href={href} className="line-clamp-2 hover:text-link-hover">{product.name}</Link>
        </h3>
        <Stars value={product.ratingAvg} count={product.reviewCount} size={14} />

        <div className="mt-1">
          <Price gbpMinor={product.priceMinor} fx={fx} size="md" />
        </div>

        {door !== null && ctx && (
          <p className="text-xs leading-snug">
            <span className="font-bold text-green">{ghs(door)}</span>
            <span className="text-ink-soft"> (about {gbp(ghsToGbpMinor(door, fx))}) delivered to {ctx.zoneName}</span>
          </p>
        )}
        <div className="mt-auto pt-2">
          <QuickAdd productId={product.id} slug={product.slug} hasOptions={product.options.length > 0} />
        </div>
      </div>
    </article>
  );
}
