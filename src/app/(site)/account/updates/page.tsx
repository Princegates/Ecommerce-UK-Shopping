import type { Metadata } from "next";
import Link from "next/link";
import MarkSeen from "@/components/account/MarkSeen";
import { requireCustomer } from "@/lib/customer-session";
import { updatesFeed } from "@/lib/customers";
import { STATUS_LABEL, isOrderStatus } from "@/lib/order-status";

export const metadata: Metadata = { title: "Order updates" };

export default async function UpdatesPage() {
  const c = await requireCustomer("/account/updates");
  const feed = updatesFeed(c.id, 60);
  return (
    <>
      <MarkSeen />
      <p className="label">Your account</p>
      <h1 className="text-5xl">Order updates</h1>
      <p className="mt-2 max-w-xl text-ink-soft">Everything that has happened on your orders, newest first.</p>
      {feed.length === 0 ? (
        <p className="mt-8">Nothing yet. Updates appear here as soon as you place an order.</p>
      ) : (
        <ol className="mt-6 grid gap-3">
          {feed.map((u, i) => (
            <li key={i} className={`box flex flex-wrap items-start justify-between gap-3 p-4 ${u.isNew ? "!bg-gold/30" : ""}`}>
              <div>
                <p className="font-semibold">
                  {isOrderStatus(u.status) ? STATUS_LABEL[u.status] : u.status}
                  {u.isNew && <span className="tag tag-gold ml-2">New</span>}
                </p>
                {u.note && <p className="text-sm text-ink-soft">{u.note}</p>}
                <p className="label num mt-1">{u.at} UTC</p>
              </div>
              <Link href={`/account/orders/${u.orderNumber}`} className="mono link text-sm font-semibold">{u.orderNumber}</Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
