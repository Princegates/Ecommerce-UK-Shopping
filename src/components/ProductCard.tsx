import Link from "next/link";
import { dealPercent, isDealLive, type Product } from "@/lib/catalog";
import type { DeliveryContext } from "@/lib/landed";
import { landedMinor } from "@/lib/landed";
import { gbp, ghs } from "@/lib/money";
import { gbpToGhsMinor, type FxConfig } from "@/lib/pricing";
import ProductArt from "./ProductArt";
import Countdown from "./shop/Countdown";
import QuickAdd from "./shop/QuickAdd";
import Stars from "./shop/Stars";
import WishlistButton from "./shop/WishlistButton";

/**
 * A product tile. Shows the price in cedis, any real deal, the rating when there are reviews,
 * and what it costs delivered to the shopper's chosen area.
 */
export default function ProductCard({
  product, fx, ctx, saved = false, badge, countdown = false,
}: {
  product: Product;
  fx: FxConfig;
  ctx?: DeliveryContext | null;
  saved?: boolean;
  badge?: "new";
  countdown?: boolean;
}) {
  const deal = isDealLive(product);
  const pct = deal ? dealPercent(product) : 0;
  const price = gbpToGhsMinor(product.priceMinor, fx);
  const was = deal && product.compareAtMinor ? gbpToGhsMinor(product.compareAtMinor, fx) : null;
  const href = `/products/${product.slug}`;

  return (
    <article className="box box-shadow relative flex h-full flex-col transition-transform hover:-translate-y-0.5">
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden="true">
          <ProductArt name={product.name} accent={product.shopAccent} imageUrl={product.imageUrl} />
        </Link>
        {deal && <span className="badge badge-deal left-2 top-2">-{pct}%</span>}
        {!deal && badge === "new" && <span className="badge badge-new left-2 top-2">New</span>}
        <WishlistButton productId={product.id} saved={saved} className="absolute right-2 top-2 z-10" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <Link href={`/shops/${product.shopSlug}`} className="label hover:underline">{product.shopName}</Link>
        <h3 className="!text-base !leading-snug">
          <Link href={href} className="line-clamp-2 hover:underline">{product.name}</Link>
        </h3>
        <Stars value={product.ratingAvg} count={product.reviewCount} size={14} />

        <div className="mt-auto grid gap-0.5 pt-2">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="num display text-2xl">{ghs(price)}</span>
            {was && <span className="was num text-sm">{ghs(was)}</span>}
          </p>
          <p className="label num">{gbp(product.priceMinor)} at the UK shop</p>
          {ctx && (
            <p className="mt-1 text-sm">
              <span className="font-bold">{ghs(landedMinor(product, ctx))}</span>
              <span className="text-ink-soft"> to your door, {ctx.zoneName}</span>
            </p>
          )}
          {countdown && deal && product.dealEndsAt && (
            <p className="mt-1 text-xs font-semibold text-red">Ends in <Countdown endsAt={product.dealEndsAt} /></p>
          )}
        </div>
        <div className="pt-2">
          <QuickAdd productId={product.id} slug={product.slug} hasOptions={product.options.length > 0} />
        </div>
      </div>
    </article>
  );
}
