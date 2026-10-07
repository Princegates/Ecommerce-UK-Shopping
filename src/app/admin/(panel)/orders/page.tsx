import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { PageHead } from "@/components/admin/ui";
import { ghs } from "@/lib/money";
import { listOrders } from "@/lib/orders";
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const orders = listOrders({ status, q });
  return (
    <>
      <PageHead title="Orders" />
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <div className="field">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="Order number, name or phone" />
        </div>
        <div className="field">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue={status ?? ""}>
            <option value="">All</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <button className="btn">Filter</button>
      </form>
      {orders.length === 0 ? (
        <p>No orders match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-cards">
            <thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th>Area</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td data-label=""><Link className="link mono" href={`/admin/orders/${o.id}`}>{o.number}</Link></td>
                  <td data-label="Placed" className="num whitespace-nowrap">{o.createdAt.slice(0, 10)}</td>
                  <td data-label="Customer">{o.customerName}<br /><span className="label">{o.phone}</span></td>
                  <td data-label="Area">{o.zoneName}</td>
                  <td data-label="Status">{STATUS_LABEL[o.status as OrderStatus]}{o.paymentStatus !== "PAID" && <span className="tag ml-2">{o.paymentStatus}</span>}</td>
                  <td data-label="Total" className="num text-right">{ghs(o.totalMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
