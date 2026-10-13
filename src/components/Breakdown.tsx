import { gbp, ghs } from "@/lib/money";

/** What a customer sees of an order's cost: items, one all-in delivery line, and the total. */
export type BreakdownAmounts = {
  itemsGbpMinor: number;
  /** Items at the customer rate, with the service charge included in the item prices. */
  itemsMinor: number;
  /** Shipping, cargo insurance, import duties and taxes, and delivery to the door. */
  deliveryAndImportMinor: number;
  totalMinor: number;
};

/** Said wherever a total is shown, so the customer knows what it covers and that nothing is due on delivery. */
export const BREAKDOWN_NOTE =
  "Item prices include our service charge. The delivery line covers shipping to Ghana, cargo insurance, import duties and taxes, and delivery to your door, so there is nothing more to pay on delivery.";

export default function Breakdown({
  b,
  showGbp = true,
  approxGbpMinor,
}: {
  b: BreakdownAmounts;
  showGbp?: boolean;
  /** The total in pounds at the same rate, shown under the cedi total. */
  approxGbpMinor?: number;
}) {
  return (
    <dl>
      <div className="row">
        <dt>Items{showGbp ? ` (${gbp(b.itemsGbpMinor)})` : ""}</dt>
        <dd className="num">{ghs(b.itemsMinor)}</dd>
      </div>
      <div className="row">
        <dt>Delivery, insurance and import duties</dt>
        <dd className="num">{ghs(b.deliveryAndImportMinor)}</dd>
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
