import { gbp, ghs } from "@/lib/money";
import type { PriceBreakdown } from "@/lib/pricing";

/** Itemised landed cost: items + service charge + shipping + delivery. */
export default function Breakdown({
  b,
  serviceLabel = "Service charge",
  shippingLabel = "Shipping to Ghana",
  deliveryLabel = "Delivery in Ghana",
  showGbp = true,
  approxGbpMinor,
}: {
  b: Pick<PriceBreakdown, "itemsGbpMinor" | "itemsGhsMinor" | "serviceFeeMinor" | "shippingMinor" | "deliveryMinor" | "totalMinor">;
  serviceLabel?: string;
  shippingLabel?: string;
  deliveryLabel?: string;
  showGbp?: boolean;
  /** The total in pounds at the same rate, shown under the cedi total. */
  approxGbpMinor?: number;
}) {
  return (
    <dl>
      <div className="row">
        <dt>Items{showGbp ? ` (${gbp(b.itemsGbpMinor)})` : ""}</dt>
        <dd className="num">{ghs(b.itemsGhsMinor)}</dd>
      </div>
      <div className="row">
        <dt>{serviceLabel}</dt>
        <dd className="num">{ghs(b.serviceFeeMinor)}</dd>
      </div>
      <div className="row">
        <dt>{shippingLabel}</dt>
        <dd className="num">{ghs(b.shippingMinor)}</dd>
      </div>
      <div className="row">
        <dt>{deliveryLabel}</dt>
        <dd className="num">{ghs(b.deliveryMinor)}</dd>
      </div>
      <hr />
      <div className="row total">
        <dt>Total to pay</dt>
        <dd className="num">{ghs(b.totalMinor)}</dd>
      </div>
      {approxGbpMinor !== undefined && (
        <div className="row !pt-0">
          <dt />
          <dd className="num text-sm text-ink-soft">about {gbp(approxGbpMinor)}</dd>
        </div>
      )}
    </dl>
  );
}
