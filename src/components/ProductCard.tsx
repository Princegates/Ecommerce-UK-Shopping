import Link from "next/link";
import { dealPercent, isDealLive, type Product } from "@/lib/catalog";
import type { DeliveryContext } from "@/lib/landed";
import { landedMinor } from "@/lib/landed";
import { gbp, ghs } from "@/lib/money";
import { ghsToGbpMinor, gbpToGhsMinor, type FxConfig } from "@/lib/pricing";
import Price from "./Price";
import ProductArt from "./ProductArt";
import Countdown from "./shop/Countdown";
import QuickAdd from "./shop/QuickAdd";
import Stars from "./shop/Stars";
import WishlistButton from "./shop/WishlistButton";

/**
 * A product tile. Prices appear in cedis and pounds, a real deal gets a yellow savings tag,
 * the rating shows when there are reviews, and the line under the price says what it costs delivered.
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
  const was = deal ? product.compareAtMinor : null;
  const saveGbp = was ? was - product.priceMinor : 0;
  const href = `/products/${product.slug}`;
  const door = ctx ? landedMinor(product, ctx) : null;

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(16,20,18,0.16)]">
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
          <ProductArt name={product.name} accent={product.shopAccent} imageUrl={product.imageUrl} />
        </Link>
        {deal && <span className="badge badge-deal left-0 top-3 !rounded-l-none !rounded-r-md !py-1 !pl-2 !pr-2.5">-{pct}% off</span>}
        {!deal && badge === "new" && <span className="badge badge-new left-0 top-3 !rounded-l-none !rounded-r-md !py-1 !pl-2 !pr-2.5">New in</span>}
        <WishlistButton productId={product.id} saved={saved} className="absolute right-2 top-2 z-10" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 pt-1">
        <Link href={`/shops/${product.shopSlug}`} className="text-xs text-link hover:text-link-hover hover:underline">{product.shopName}</Link>
        <h3 className="!text-sm !font-normal !leading-snug">
          <Link href={href} className="line-clamp-2 hover:text-link-hover">{product.name}</Link>
        </h3>
        <Stars value={product.ratingAvg} count={product.reviewCount} size={14} />

        <div className="mt-1">
          <Price gbpMinor={product.priceMinor} wasGbpMinor={was} fx={fx} size="md" />
          {saveGbp > 0 && (
            <p className="mt-1.5 inline-block rounded bg-spark px-1.5 py-0.5 text-xs font-bold text-ink">
              Save {gbp(saveGbp)} · {ghs(gbpToGhsMinor(saveGbp, fx))}
            </p>
          )}
        </div>

        {door !== null && ctx && (
          <p className="text-xs leading-snug">
            <span className="font-bold text-green">{ghs(door)}</span>
            <span className="text-ink-soft"> (about {gbp(ghsToGbpMinor(door, fx))}) delivered to {ctx.zoneName}</span>
          </p>
        )}
        {countdown && deal && product.dealEndsAt && (
          <p className="text-xs font-bold text-red">Deal ends in <Countdown endsAt={product.dealEndsAt} /></p>
        )}
        <div className="mt-auto pt-2">
          <QuickAdd productId={product.id} slug={product.slug} hasOptions={product.options.length > 0} />
        </div>
      </div>
    </article>
  );
}
