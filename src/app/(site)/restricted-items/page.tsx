import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Items we cannot ship" };

export default function RestrictedItemsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="text-3xl">Items we cannot buy or ship</h1>
      <p className="mt-4 text-ink-soft">
        We shop the UK for you and send your order to Ghana by air. A few kinds of item cannot go that way, or need approvals we do not hold, so we do not take them.
      </p>
      <ul className="mt-6 grid gap-3">
        <li className="box p-4"><strong>Muscle stimulators.</strong> TENS and EMS machines, including foot massagers with these functions. They are medical-type devices with batteries.</li>
        <li className="box p-4"><strong>Powered massage machines.</strong> Electric, rechargeable or battery-powered massagers, massage guns, chairs and similar devices.</li>
      </ul>
      <p className="mt-6 text-sm text-ink-soft">
        Batteries in these devices are limited on air freight, and medical devices are regulated. If you are not sure about an item, ask us before you order.
        The full rules are in our <Link href="/policies/prohibited-and-restricted-items" className="link">prohibited and restricted items policy</Link>.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/shops" className="btn btn-primary">Browse the shops</Link>
        <Link href="/request" className="btn">Request another item</Link>
      </div>
    </div>
  );
}
