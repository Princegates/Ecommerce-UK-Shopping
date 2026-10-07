import type { Metadata } from "next";
import Link from "next/link";
import { buyAgainAction } from "@/app/actions/cart";
import ProductArt from "@/components/ProductArt";
import StatusTracker from "@/components/StatusTracker";
import StatusChip from "@/components/StatusChip";
import { getProductById } from "@/lib/catalog";
import { requireCustomer } from "@/lib/customer-session";
import { STATUS_LABEL } from "@/lib/order-status";
import { listAddresses } from "@/lib/customers";
import { ghs } from "@/lib/money";
import { gbpToGhsMinor } from "@/lib/pricing";
import { listOrdersForCustomer, reorderableItems } from "@/lib/orders";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountHome({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const c = await requireCustomer("/account");
  const sp = await searchParams;
  const orders = listOrdersForCustomer(c.id);
  const addresses = listAddresses(c.id);
  const fx = getSettings().fx;
  const latestOpen = orders.find((o) => o.status !== "AWAITING_PAYMENT" && !["DELIVERED", "CANCELLED", "REFUNDED"].includes(o.status));
  const active = orders.filter((o) => !["DELIVERED", "CANCELLED", "REFUNDED"].includes(o.status)).length;
  const delivered = orders.filter((o) => o.status === "DELIVERED").length;

  // Items from the most recent orders that are still on sale
  const seen = new Set<number>();
  const again = orders
    .slice(0, 5)
    .flatMap((o) => reorderableItems(c.id, o.number).map((i) => ({ ...i, number: o.number })))
    .filter((i) => (seen.has(i.productId) ? false : (seen.add(i.productId), true)))
    .map((i) => ({ item: i, product: getProductById(i.productId) }))
    .filter((x) => x.product)
    .slice(0, 5);

  const tiles: [string, number, string][] = [
    ["In progress", active, "/account/orders"],
    ["Delivered", delivered, "/account/orders"],
    ["Saved addresses", addresses.length, "/account/addresses"],
  ];

  return (
    <>
      <p className="label">Your account</p>
      <h1 className="text-3xl">Hello, {c.name.split(" ")[0]}</h1>
      {sp.reset && <p role="status" className="box mt-4 bg-gold/40 p-3 font-semibold">Your password was changed and you are signed in.</p>}

      {latestOpen && (
        <section aria-labelledby="live" className="box box-shadow mt-6 grid gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label">Live tracking</p>
              <h2 id="live" className="text-2xl">{STATUS_LABEL[latestOpen.status]}</h2>
              <p className="text-sm text-ink-soft">
                <span className="mono">{latestOpen.number}</span> · {latestOpen.firstItem}{latestOpen.itemCount > 1 ? ` + ${latestOpen.itemCount - 1} more` : ""}
              </p>
            </div>
            <Link href={`/account/orders/${latestOpen.number}`} className="btn btn-small btn-primary">Full tracking</Link>
          </div>
          <StatusTracker status={latestOpen.status} />
        </section>
      )}

      <ul className="mt-6 grid grid-cols-3 gap-3">
        {tiles.map(([label, n, href]) => (
          <li key={label}>
            <Link href={href} className="box box-shadow block p-4 hover:-translate-y-0.5">
              <p className="label">{label}</p>
              <p className="display num text-2xl">{n}</p>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl">Recent orders</h2>
          {orders.length > 3 && <Link href="/account/orders" className="link font-semibold">All orders →</Link>}
        </div>
        {orders.length === 0 ? (
          <div className="box mt-4 p-6">
            <p className="font-semibold">You have not ordered yet.</p>
            <p className="mt-1 text-ink-soft">Browse the UK shops and your orders will appear here, with tracking.</p>
            <Link href="/shops" className="btn btn-primary mt-4">Start shopping</Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {orders.slice(0, 3).map((o) => (
              <li key={o.id} className="box flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="mono font-semibold">{o.number}</p>
                  <p className="text-sm text-ink-soft">
                    {o.firstItem}{o.itemCount > 1 ? ` + ${o.itemCount - 1} more` : ""} · {o.createdAt.slice(0, 10)}
                  </p>
                </div>
                <StatusChip status={o.status} />
                <p className="num font-semibold">{ghs(o.totalMinor)}</p>
                <Link href={o.status === "AWAITING_PAYMENT" ? `/pay/${o.paymentRef}` : `/account/orders/${o.number}`} className="btn btn-small">{o.status === "AWAITING_PAYMENT" ? "Pay now" : "Track"}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {again.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl">Buy again</h2>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {again.map(({ item, product }) => (
              <li key={product!.id} className="box flex flex-col">
                <Link href={`/products/${product!.slug}`}>
                  <ProductArt name={product!.name} accent={product!.shopAccent} imageUrl={product!.imageUrl} />
                </Link>
                <div className="grid flex-1 gap-1 p-3">
                  <p className="line-clamp-2 text-sm font-semibold">{product!.name}</p>
                  <p className="num display">{ghs(gbpToGhsMinor(product!.priceMinor, fx))}</p>
                  <form action={buyAgainAction} className="mt-auto pt-2">
                    <input type="hidden" name="number" value={item.number} />
                    <button className="btn btn-small btn-gold w-full">Add order again</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
