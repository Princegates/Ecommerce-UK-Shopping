import Link from "next/link";
import { buyAgainAction } from "@/app/actions/cart";
import Breakdown from "@/components/Breakdown";
import StatusChip from "@/components/StatusChip";
import StatusTracker from "@/components/StatusTracker";
import { ghsToGbpMinor } from "@/lib/pricing";
import { ghs } from "@/lib/money";
import type { OrderEvent, OrderItemRow, OrderRow, TrackingEntry } from "@/lib/orders";
import { TRACKING_STAGE_LABEL } from "@/lib/orders";
import { PROGRESS, STATUS_HELP, STATUS_LABEL, isOrderStatus } from "@/lib/order-status";

const fmt = (iso: string) => iso.slice(0, 10);

/** The full tracking page for one order. Used inside the account and for the public order link. */
export default function OrderDetailView({
  order, items, events, tracking, whatsapp, account,
}: {
  order: OrderRow;
  items: OrderItemRow[];
  events: OrderEvent[];
  tracking: TrackingEntry[];
  whatsapp?: string;
  account: boolean;
}) {
  const awaiting = order.status === "AWAITING_PAYMENT";
  const reachedAt = new Map<string, string>();
  for (const e of [...events].reverse()) if (!reachedAt.has(e.status)) reachedAt.set(e.status, e.createdAt);
  const wa = (whatsapp ?? "").replace(/\D/g, "");
  const closed = order.status === "CANCELLED" || order.status === "REFUNDED";
  const received = reachedAt.get("AT_UK_WAREHOUSE");

  return (
    <div className="grid gap-10">
      <header>
        <p className="label">Order</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mono text-3xl font-semibold tracking-tight sm:text-2xl">{order.number}</h1>
          <StatusChip status={order.status} />
        </div>
        <p className="mt-1 text-ink-soft">Placed {fmt(order.createdAt)} · {order.customerName}</p>
      </header>

      <section aria-labelledby="status-h" className="box box-shadow grid gap-5 p-5">
        <div>
          <h2 id="status-h" className="text-3xl">{STATUS_LABEL[order.status]}</h2>
          <p className="mt-1 text-ink-soft">{STATUS_HELP[order.status]}</p>
          {received && !closed && order.status !== "DELIVERED" && (
            <p className="mt-2 font-semibold">Received at our UK address on {fmt(received)}.</p>
          )}
        </div>
        <StatusTracker status={order.status} />
        <div className="flex flex-wrap items-center gap-3">
          {awaiting && <Link href={`/pay/${order.paymentRef}`} className="btn btn-primary">Pay {ghs(order.totalMinor)} now</Link>}
          {!awaiting && order.paymentStatus === "PAID" && <span className="tag tag-green">Payment received</span>}
          {order.paymentStatus === "FAILED" && <span className="error-text">Your last payment attempt failed.</span>}
          {account && (
            <form action={buyAgainAction}>
              <input type="hidden" name="number" value={order.number} />
              <button className="btn btn-small">Buy again</button>
            </form>
          )}
          {wa && <a className="btn btn-small" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi, about order ${order.number}`)}`} target="_blank" rel="noopener noreferrer">Ask on WhatsApp</a>}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-10">
          {tracking.length > 0 && (
            <section aria-labelledby="track-h">
              <h2 id="track-h" className="text-2xl">Tracking numbers</h2>
              <ul className="mt-3 grid gap-3">
                {tracking.map((t) => (
                  <li key={t.id} className="box p-4">
                    <p className="label">{TRACKING_STAGE_LABEL[t.stage] ?? t.stage}</p>
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                      {t.carrier && <span className="font-semibold">{t.carrier}</span>}
                      {t.reference && <span className="mono select-all">{t.reference}</span>}
                    </p>
                    {t.note && <p className="text-sm text-ink-soft">{t.note}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                      <span className="label num">{fmt(t.createdAt)}</span>
                      {t.url && <a href={t.url} target="_blank" rel="noopener noreferrer" className="link font-semibold">Track with {t.carrier || "the carrier"} ↗</a>}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!closed && (
            <section aria-labelledby="miles-h">
              <h2 id="miles-h" className="text-2xl">Progress</h2>
              <ol className="mt-3 border-t border-line">
                {PROGRESS.map((s) => {
                  const at = reachedAt.get(s);
                  return (
                    <li key={s} className="flex items-center justify-between gap-4 border-b border-line py-2.5">
                      <span className={`flex items-center gap-3 ${at ? "font-semibold" : "text-ink/50"}`}>
                        <span aria-hidden="true" className={`mono grid h-5 w-5 place-items-center border-2 text-xs ${at ? "border-green bg-green text-paper" : "border-line"}`}>{at ? "✓" : ""}</span>
                        {STATUS_LABEL[s]}
                      </span>
                      <span className="label num">{at ? fmt(at) : "Waiting"}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section>
            <h2 className="text-2xl">Items</h2>
            <ul className="mt-3 border-t border-line">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 border-b border-line py-3">
                  <div>
                    <p className="font-semibold">{i.quantity} × {i.name}</p>
                    <p className="label">{i.shopName}</p>
                    {Object.keys(i.options).length > 0 && (
                      <p className="text-sm text-ink-soft">{Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                    )}
                  </div>
                  <p className="num whitespace-nowrap">{ghs(i.lineGhsMinor)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl">Updates</h2>
            <ol className="mt-3 border-l border-line pl-5">
              {[...events].reverse().map((e, idx) => (
                <li key={idx} className="relative pb-5">
                  <span className="absolute -left-[1.62rem] top-1.5 h-3 w-3 border border-line bg-gold" aria-hidden="true" />
                  <p className="font-semibold">{isOrderStatus(e.status) ? STATUS_LABEL[e.status] : e.status}</p>
                  {e.note && <p className="text-sm text-ink-soft">{e.note}</p>}
                  <p className="label num">{e.createdAt} UTC</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="grid content-start gap-8">
          <div className="receipt p-5">
            <h2 className="!text-xl">What you paid</h2>
            <div className="mt-3"><Breakdown b={order} approxGbpMinor={ghsToGbpMinor(order.totalMinor, { rate: order.fxRate, markupPct: order.fxMarkupPct })} /></div>
            <hr />
            <p className="text-xs text-ink-soft">
              Priced at £1 = GH₵{(order.fxRate * (1 + order.fxMarkupPct / 100)).toFixed(4)} when you ordered. Import duty charged by customs, if any, is not included.
            </p>
          </div>
          <section className="box p-5">
            <h2 className="text-xl">Delivery</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div><dt className="label">To</dt><dd>{order.customerName}</dd></div>
              <div><dt className="label">Address</dt><dd className="whitespace-pre-line">{order.address}{order.landmark ? `\n${order.landmark}` : ""}</dd></div>
              <div><dt className="label">Area</dt><dd>{order.zoneName}</dd></div>
              <div><dt className="label">Shipping</dt><dd>{order.shippingName}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
