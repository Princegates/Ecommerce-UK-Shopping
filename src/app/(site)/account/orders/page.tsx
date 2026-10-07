import type { Metadata } from "next";
import Link from "next/link";
import { buyAgainAction } from "@/app/actions/cart";
import StatusChip from "@/components/StatusChip";
import { requireCustomer } from "@/lib/customer-session";
import { ghs } from "@/lib/money";
import { listOrdersForCustomer } from "@/lib/orders";

export const metadata: Metadata = { title: "Your orders" };

const FILTERS: [string, string, (s: string) => boolean][] = [
  ["all", "All", () => true],
  ["open", "In progress", (s) => !["DELIVERED", "CANCELLED", "REFUNDED"].includes(s)],
  ["delivered", "Delivered", (s) => s === "DELIVERED"],
  ["closed", "Cancelled or refunded", (s) => s === "CANCELLED" || s === "REFUNDED"],
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ filter?: string; error?: string }> }) {
  const c = await requireCustomer("/account/orders");
  const sp = await searchParams;
  const filter = FILTERS.find(([k]) => k === sp.filter) ?? FILTERS[0];
  const all = listOrdersForCustomer(c.id);
  const orders = all.filter((o) => filter[2](o.status));

  return (
    <>
      <p className="label">Your account</p>
      <h1 className="text-3xl">Your orders</h1>
      {sp.error && <p role="alert" className="box mt-4 border-red bg-red/10 p-3 font-semibold text-red">{sp.error}</p>}
      <nav aria-label="Filter orders" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={k === "all" ? "/account/orders" : `/account/orders?filter=${k}`} aria-current={filter[0] === k ? "page" : undefined} className={`tag !px-3 !py-1.5 ${filter[0] === k ? "!bg-ink !text-paper" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="mt-8">{all.length === 0 ? "You have not placed an order yet." : "No orders in this view."}</p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {orders.map((o) => (
            <li key={o.id} className="box box-shadow grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="mono text-lg font-semibold">{o.number}</p>
                  <StatusChip status={o.status} />
                </div>
                <p className="text-ink-soft">
                  {o.firstItem}{o.itemCount > 1 ? ` + ${o.itemCount - 1} more` : ""}
                </p>
                <p className="label num">Placed {o.createdAt.slice(0, 10)} · {o.zoneName} · {ghs(o.totalMinor)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={o.status === "AWAITING_PAYMENT" ? `/pay/${o.paymentRef}` : `/account/orders/${o.number}`} className="btn btn-small btn-primary">{o.status === "AWAITING_PAYMENT" ? "Pay now" : "Track order"}</Link>
                <form action={buyAgainAction}>
                  <input type="hidden" name="number" value={o.number} />
                  <button className="btn btn-small">Buy again</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
