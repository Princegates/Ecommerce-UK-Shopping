import Link from "next/link";
import { getRequestForOrder } from "@/lib/link-orders";
import { notFound } from "next/navigation";
import { setOrderStatusAction } from "@/app/admin/actions";
import { addTrackingAction, deleteTrackingAction, saveCostsAction } from "@/app/admin/ops-actions";
import { Flash, PageHead } from "@/components/admin/ui";
import Breakdown from "@/components/Breakdown";
import StatusChip from "@/components/StatusChip";
import { can, requirePermission } from "@/lib/auth";
import { getCustomerById } from "@/lib/customers";
import { EMPTY_COSTS, getCosts, orderMargin } from "@/lib/margin";
import { ghs, minorToInput } from "@/lib/money";
import {
  TRACKING_STAGES, TRACKING_STAGE_LABEL, getOrderById, getOrderEvents, getOrderItems, getTracking,
} from "@/lib/orders";
import { STATUS_LABEL, isOrderStatus, staffNextStatuses } from "@/lib/order-status";
import { attemptsForOrder } from "@/lib/payments/confirm";
import { db } from "@/lib/db";

function Money({ label, name, value, hint }: { label: string; name: string; value: number; hint?: string }) {
  return (
    <div className="field">
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" inputMode="decimal" defaultValue={value ? minorToInput(value) : ""} placeholder="0.00" />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export default async function AdminOrder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const who = await requirePermission("orders.view");
  const canManage = can(who, "orders.manage");
  const canCosts = can(who, "orders.costs");
  const { id } = await params;
  const sp = await searchParams;
  const order = getOrderById(Number(id));
  if (!order) notFound();
  const items = getOrderItems(order.id);
  const events = getOrderEvents(order.id).reverse();
  const next = staffNextStatuses(order.status, order.paymentStatus);
  const tracking = getTracking(order.id);
  const attempts = attemptsForOrder(order.id);
  const costs = getCosts(order.id);
  const quotedRate = order.fxRate;
  const margin = costs && order.paymentStatus === "PAID" ? orderMargin(order.totalMinor, quotedRate, costs) : null;
  const c = costs ?? EMPTY_COSTS;
  const owner = (db().prepare("SELECT customer_id AS id FROM orders WHERE id = ?").get(order.id) as { id: number | null }).id;
  const customer = owner ? getCustomerById(owner) : null;
  const fromLink = getRequestForOrder(order.id);

  return (
    <>
      <PageHead title={order.number}>
        <Link href="/admin/orders" className="link">← All orders</Link>
      </PageHead>
      <Flash saved={sp.saved} error={sp.error} />

      {fromLink && (
        <section className="box mb-6 grid gap-1 !border-gold bg-gold/25 p-4 text-sm">
          <p className="font-bold">Link order: check the price on the shop before buying</p>
          <p>
            <a href={fromLink.url} target="_blank" rel="noopener noreferrer" className="link break-all">{fromLink.url} ↗</a>
            {fromLink.details ? ` · ${fromLink.details}` : ""}
          </p>
          <p>
            Quoted £{((fromLink.quotePriceMinor ?? 0) / 100).toFixed(2)} each
            {fromLink.quoteSource === "page" && " · price was read from the shop's page by the system"}
            {fromLink.quoteSource === "customer" && ` · price was typed by the customer (£${((fromLink.quoteBasisMinor ?? 0) / 100).toFixed(2)}) plus a safety margin, so it is not verified`}
            {fromLink.quoteSource === "" && " · quoted by the team"}
            {" "}· <Link href="/admin/requests" className="link">request #{fromLink.id}</Link>
          </p>
          <p className="text-ink-soft">If the shop&rsquo;s price is higher now, contact the customer before buying. You can cancel and refund the order from this page.</p>
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-8">
          <section className="box box-shadow p-5">
            <p className="label">Status</p>
            <p className="flex items-center gap-3"><span className="display text-3xl">{STATUS_LABEL[order.status]}</span><StatusChip status={order.status} /></p>
            <p className="hint">Payment: {order.paymentStatus}</p>
            {order.status === "AWAITING_PAYMENT" && <p className="mt-2">Waiting for the customer to pay. Do not buy anything yet.</p>}
            {order.status === "CANCELLED" && order.paymentStatus === "PAID" && (
              <p className="box mt-3 border-red bg-red/10 p-3 font-semibold text-red">This order was paid and then cancelled. Refund the customer, then mark it refunded.</p>
            )}
            {canManage && next.length > 0 ? (
              <form action={setOrderStatusAction} className="mt-4 grid gap-3">
                <input type="hidden" name="orderId" value={order.id} />
                <div className="field">
                  <label className="label" htmlFor="note">Note (optional, the customer sees it)</label>
                  <input id="note" name="note" className="input" placeholder="e.g. UK order reference 123-456" maxLength={500} />
                </div>
                <div className="flex flex-wrap gap-3">
                  {next.map((s) => (
                    <button key={s} name="status" value={s} className={`btn ${s === "CANCELLED" ? "btn-danger" : "btn-primary"}`}>Mark as: {STATUS_LABEL[s]}</button>
                  ))}
                </div>
                <p className="hint">The customer is told by SMS, email or WhatsApp according to your rules and their choices.</p>
              </form>
            ) : (
              !canManage ? <p className="mt-3 text-ink-soft">You can look at this order but not change it.</p> : order.status !== "AWAITING_PAYMENT" && <p className="mt-3 text-ink-soft">No further changes are possible.</p>
            )}
          </section>

          <section>
            <h2 className="text-2xl">Items to buy</h2>
            <table className="table mt-3">
              <thead><tr><th>Shop</th><th>Item</th><th>Qty</th><th className="text-right">UK price each</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.shopName}</td>
                    <td>
                      {i.name}
                      {Object.keys(i.options).length > 0 && <span className="block text-ink-soft">{Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>}
                      {i.sourceUrl && <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer" className="link text-sm">Open UK listing ↗</a>}
                    </td>
                    <td className="num">{i.quantity}</td>
                    <td className="num text-right">£{(i.unitPriceMinor / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="tracking" className="scroll-mt-24">
            <h2 className="text-2xl">Tracking numbers</h2>
            <p className="mt-1 text-sm text-ink-soft">Add these as the order moves. The customer sees them on their order page.</p>
            {tracking.length > 0 && (
              <ul className="mt-3 grid gap-2">
                {tracking.map((t) => (
                  <li key={t.id} className="box flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                    <span>
                      <span className="label block">{TRACKING_STAGE_LABEL[t.stage]}</span>
                      <span className="font-semibold">{t.carrier}</span> <span className="mono">{t.reference}</span>
                      {t.note && <span className="block text-ink-soft">{t.note}</span>}
                    </span>
                    {canManage && (
                      <form action={deleteTrackingAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="trackingId" value={t.id} />
                        <button className="link text-red">Remove</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canManage && (
            <form action={addTrackingAction} className="box mt-4 grid gap-3 p-4">
              <input type="hidden" name="orderId" value={order.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="field">
                  <label className="label" htmlFor="stage">Stage</label>
                  <select id="stage" name="stage" className="select">
                    {TRACKING_STAGES.map((s) => <option key={s} value={s}>{TRACKING_STAGE_LABEL[s]}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="carrier">Carrier or company</label>
                  <input id="carrier" name="carrier" className="input" placeholder="Royal Mail, DHL, courier name" />
                </div>
                <div className="field">
                  <label className="label" htmlFor="reference">Tracking number</label>
                  <input id="reference" name="reference" className="input mono" />
                </div>
                <div className="field">
                  <label className="label" htmlFor="url">Tracking link (optional)</label>
                  <input id="url" name="url" className="input" placeholder="https://" />
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="tnote">Note for the customer (optional)</label>
                <input id="tnote" name="note" className="input" maxLength={300} />
              </div>
              <div><button className="btn btn-small btn-primary">Add tracking</button></div>
            </form>
            )}
          </section>

          <section>
            <h2 className="text-2xl">History</h2>
            <ol className="mt-3 grid gap-2">
              {events.map((e, i) => (
                <li key={i} className="border-l border-line pl-3">
                  <span className="font-semibold">{isOrderStatus(e.status) ? STATUS_LABEL[e.status] : e.status}</span>
                  <span className="label ml-3 num">{e.createdAt} UTC</span>
                  {e.note && <p className="text-sm text-ink-soft">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="grid content-start gap-8">
          <section className="receipt p-5">
            <h2 className="!text-xl">Customer paid</h2>
            <div className="mt-3"><Breakdown b={order} /></div>
            <hr />
            <p className="text-xs">Rate £1 = GH₵{(order.fxRate * (1 + order.fxMarkupPct / 100)).toFixed(4)} · {order.chargeableGrams} g chargeable · {order.shippingName}</p>
          </section>

          {canCosts && (
          <section id="costs" className="box p-5 scroll-mt-24">
            <h2 className="text-xl">What it cost us</h2>
            <p className="mb-3 mt-1 text-sm text-ink-soft">Enter real costs as you pay them to see the margin on this order.</p>
            <form action={saveCostsAction} className="grid gap-3">
              <input type="hidden" name="orderId" value={order.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Money label="Shop price paid (£)" name="retailerGbp" value={c.retailerGbpMinor} />
                <Money label="UK delivery paid (£)" name="ukDeliveryGbp" value={c.ukDeliveryGbpMinor} />
              </div>
              <div className="field">
                <label className="label" htmlFor="purchaseRate">Rate you bought at (GH₵ per £1)</label>
                <input id="purchaseRate" name="purchaseRate" className="input" inputMode="decimal" defaultValue={c.purchaseRate || ""} placeholder={`${order.fxRate} (the quoted rate)`} />
                <p className="hint">Leave empty to use the rate the customer was quoted.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Money label="Freight (GH₵)" name="freightGhs" value={c.freightGhsMinor} />
                <Money label="Ghana delivery (GH₵)" name="localDeliveryGhs" value={c.localDeliveryGhsMinor} />
                <Money label="Payment fees (GH₵)" name="paymentFeesGhs" value={c.paymentFeesGhsMinor} />
                <Money label="Other (GH₵)" name="otherGhs" value={c.otherGhsMinor} />
              </div>
              <div className="field">
                <label className="label" htmlFor="costnote">Note</label>
                <input id="costnote" name="note" className="input" defaultValue={c.note} maxLength={300} />
              </div>
              <div><button className="btn btn-small btn-primary">Save costs</button></div>
            </form>
            {margin && (
              <dl className="receipt mt-4 p-4">
                <div className="row"><dt>Customer paid</dt><dd className="num">{ghs(margin.revenueMinor)}</dd></div>
                <div className="row"><dt>Cost</dt><dd className="num">{ghs(margin.costMinor)}</dd></div>
                <hr />
                <div className="row total"><dt>Margin</dt><dd className={`num ${margin.marginMinor < 0 ? "text-red" : ""}`}>{ghs(margin.marginMinor)}{margin.marginPct !== null && ` (${(margin.marginPct * 100).toFixed(1)}%)`}</dd></div>
              </dl>
            )}
          </section>
          )}

          <section className="box p-5">
            <h2 className="text-xl">Payments</h2>
            {attempts.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No gateway payments yet.</p>
            ) : (
              <ul className="mt-3 grid gap-2 text-sm">
                {attempts.map((a) => (
                  <li key={a.id} className="border-l border-line pl-3">
                    <span className="font-semibold">{a.provider}</span> · {a.currency} {(a.amountMinor / 100).toFixed(2)} ·{" "}
                    <span className={`tag ${a.status === "SUCCEEDED" ? "tag-green" : a.status === "MISMATCH" || a.status === "FAILED" ? "tag-red" : ""}`}>{a.status.toLowerCase()}</span>
                    <span className="label block num">{a.createdAt} UTC</span>
                    {a.note && <span className="block text-red">{a.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="box p-5">
            <h2 className="text-xl">Customer</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div><dt className="label">Name</dt><dd>{order.customerName}</dd></div>
              <div><dt className="label">Phone</dt><dd><a className="link" href={`tel:${order.phone}`}>{order.phone}</a></dd></div>
              {order.email && <div><dt className="label">Email</dt><dd>{order.email}</dd></div>}
              <div><dt className="label">Account</dt><dd>{customer ? <Link className="link" href={`/admin/customers/${customer.id}`}>{customer.name}</Link> : "Guest or deleted account"}</dd></div>
              <div><dt className="label">Deliver to</dt><dd className="whitespace-pre-line">{order.address}{order.landmark ? `\n${order.landmark}` : ""}</dd></div>
              <div><dt className="label">Area</dt><dd>{order.zoneName}</dd></div>
              {order.notes && <div><dt className="label">Note</dt><dd>{order.notes}</dd></div>}
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
