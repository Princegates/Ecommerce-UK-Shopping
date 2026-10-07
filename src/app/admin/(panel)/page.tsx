import Link from "next/link";
import { applyMarketRateAction, refreshMarketRateAction, setRateAction } from "@/app/admin/ops-actions";
import { Composition, Delta, RankBars, SalesChart } from "@/components/admin/charts";
import { PageHead } from "@/components/admin/ui";
import StatusChip from "@/components/StatusChip";
import {
  RANGES, actionQueue, change, customerStats, kpis, margins, parseRange, pipeline, salesByDay, topAreas, topItems, topShops,
} from "@/lib/analytics";
import { appUrl } from "@/lib/app-url";
import { recentAudit } from "@/lib/audit";
import { adminConfig, can, requireAdmin } from "@/lib/auth";
import { landingPage } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { STALE_AFTER_DAYS, rateAgeDays, rateHistory } from "@/lib/fx";
import { drift, getFxPolicy, getMarketRate } from "@/lib/fx-api";
import { CHANNEL_LABEL, getChannelProviderId, getIntegration, isConfigured, providersFor, readConfig } from "@/lib/integrations";
import { ghs } from "@/lib/money";
import { MESSAGE_CHANNELS, messageStats } from "@/lib/notify/outbox";
import { listOrders } from "@/lib/orders";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { demoPaymentsEnabled } from "@/lib/payments";
import { encryptionPassphrase } from "@/lib/secrets";
import { effectiveRate } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

const pct = (n: number | null) => (n === null ? "n/a" : `${(n * 100).toFixed(1)}%`);

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string; saved?: string; error?: string }> }) {
  const who = await requireAdmin();
  // someone without the dashboard goes straight to the first page they can use
  if (!can(who, "dashboard.view")) redirect(landingPage(who.permissions));
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const settings = getSettings();
  const k = kpis(range);
  const days = salesByDay(range);
  const queue = actionQueue();
  const flow = pipeline();
  const shops = topShops(range);
  const items = topItems(range);
  const areas = topAreas(range);
  const cust = customerStats(range);
  const m = margins(range);
  const msgs = messageStats(7);
  const history = rateHistory(6);
  const market = getMarketRate();
  const gap = drift();
  const policy = getFxPolicy();
  const feedOn = Boolean(getChannelProviderId("rates"));
  const age = rateAgeDays();
  const stale = age === null || age >= STALE_AFTER_DAYS;
  const recent = listOrders().slice(0, 7);
  const activity = recentAudit(8);
  const production = process.env.NODE_ENV === "production";
  const base = appUrl();

  const gateways = providersFor("payments").map((def) => {
    const cfg = readConfig(def);
    return { def, ready: isConfigured(def, cfg, "payments"), on: cfg.enabled };
  });
  const channels = MESSAGE_CHANNELS.map((c) => {
    const id = getChannelProviderId(c);
    const def = id ? getIntegration(id) : undefined;
    const cfg = def ? readConfig(def) : null;
    return { c, def, ready: Boolean(def && cfg && cfg.enabled && isConfigured(def, cfg, c)) };
  });
  const payReady = gateways.some((g) => g.ready && g.on);
  const health: [string, boolean, string][] = [
    ["A payment gateway is live", payReady || (!production && demoPaymentsEnabled()), "Customers cannot pay online yet."],
    ["Public address (APP_URL) is set", base !== null && (!production || base.startsWith("https://")), "Needed for payment returns and message links."],
    ["Keys can be stored safely", encryptionPassphrase() !== null, "Set SETTINGS_ENCRYPTION_KEY."],
    ["Admin password is not the default", !adminConfig()?.isDevDefault, "Set ADMIN_PASSWORD and ADMIN_SECRET."],
    ["Demo payments are off in production", !(production && demoPaymentsEnabled()), "Remove ALLOW_DEMO_PAYMENTS."],
    ["Retries are scheduled (CRON_SECRET)", !production || Boolean(process.env.CRON_SECRET), "Call /api/cron/messages every few minutes."],
    ["Exchange rate is fresh", !stale, `Not updated for ${age ?? "many"} days.`],
  ];

  const tiles: { label: string; value: string; now: number; before: number; note?: string }[] = [
    { label: "Revenue", value: ghs(k.revenueMinor), now: k.revenueMinor, before: k.previous.revenueMinor, note: "paid orders" },
    { label: "Orders", value: String(k.orders), now: k.orders, before: k.previous.orders },
    { label: "Average order", value: ghs(k.averageOrderMinor), now: k.averageOrderMinor, before: k.previous.averageOrderMinor },
    { label: "Service charge earned", value: ghs(k.serviceFeeMinor), now: k.serviceFeeMinor, before: 0, note: "before costs" },
    { label: "New customers", value: String(k.newCustomers), now: k.newCustomers, before: k.previous.newCustomers },
  ];

  return (
    <>
      <PageHead title="Dashboard">
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Period" className="flex gap-1">
            {RANGES.map((r) => (
              <Link key={r} href={`/admin?range=${r}`} aria-current={r === range ? "page" : undefined} className={`tag !px-3 !py-1.5 ${r === range ? "!bg-ink !text-paper" : ""}`}>{r} days</Link>
            ))}
          </nav>
          {can(who, "orders.export") && <a href="/admin/export/orders" className="btn btn-small">Export orders (CSV)</a>}
        </div>
      </PageHead>

      {sp.error && <p role="alert" className="box mb-6 border-red bg-red/10 p-3 font-semibold text-red">{sp.error}</p>}
      {sp.saved === "market" && <p role="status" className="box mb-6 bg-gold/40 p-3 font-semibold">Market rate fetched. Your quoted rate was not changed.</p>}
      {sp.saved === "rate" && <p role="status" className="box mb-6 bg-gold/40 p-3 font-semibold">Exchange rate updated. New quotes use it straight away.</p>}

      {/* ---------------------------------------------------------- needs attention */}
      <section aria-labelledby="queue-h" className="mb-10">
        <h2 id="queue-h" className="text-2xl">Needs attention</h2>
        {queue.length === 0 ? (
          <p className="box mt-3 bg-green/10 p-4 font-semibold">All clear. Nothing is waiting for you.</p>
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {queue.map((q) => (
              <li key={q.key}>
                <Link href={q.href} className={`box box-shadow flex h-full items-start gap-4 p-4 hover:-translate-y-0.5 ${q.tone === "urgent" ? "!border-red" : ""}`}>
                  <span className={`display num text-4xl ${q.tone === "urgent" ? "text-red" : ""}`}>{q.count}</span>
                  <span>
                    <span className="block font-bold">{q.label}</span>
                    <span className="text-sm text-ink-soft">{q.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------------------- KPIs */}
      <section aria-labelledby="kpi-h" className="mb-10">
        <h2 id="kpi-h" className="sr-only">Key figures, last {range} days</h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <li key={t.label} className="box box-shadow p-4">
              <p className="label">{t.label}</p>
              <p className="display num mt-1 text-2xl sm:text-3xl">{t.value}</p>
              <p className="mt-1 flex items-center gap-2">
                {t.label === "Service charge earned" ? <span className="label">{t.note}</span> : <Delta value={change(t.now, t.before)} />}
              </p>
            </li>
          ))}
        </ul>
        <p className="hint mt-2">Compared with the {range} days before. Revenue counts what customers paid, including shipping and delivery.</p>
      </section>

      {/* --------------------------------------------------------- sales + pipeline */}
      <section className="mb-10 grid gap-8 xl:grid-cols-[1.7fr_1fr]">
        <div className="box box-shadow p-5">
          <h2 className="text-2xl">Sales, last {range} days</h2>
          <div className="mt-4"><SalesChart points={days} /></div>
        </div>
        <div className="box box-shadow p-5">
          <h2 className="text-2xl">Orders in progress</h2>
          <p className="hint mb-4">Where every open order is right now.</p>
          <RankBars rows={flow.filter((f) => f.status !== "DELIVERED").map((f) => ({ name: STATUS_LABEL[f.status as OrderStatus], value: f.count }))} format={(v) => String(v)} />
          <p className="mt-4 text-sm">Delivered in total: <span className="num font-semibold">{flow.find((f) => f.status === "DELIVERED")?.count ?? 0}</span></p>
        </div>
      </section>

      {/* ---------------------------------------------- money: composition + margin */}
      <section className="mb-10 grid gap-8 xl:grid-cols-2">
        <div className="box box-shadow p-5">
          <h2 className="text-2xl">Where the money comes from</h2>
          <p className="hint mb-4">What customers paid in the last {range} days.</p>
          <Composition
            parts={[
              { label: "Items", value: k.itemsMinor, color: "var(--green)" },
              { label: "Service charge", value: k.serviceFeeMinor, color: "var(--gold)" },
              { label: "Shipping", value: k.shippingMinor, color: "var(--ink)" },
              { label: "Delivery", value: k.deliveryMinor, color: "var(--kraft)" },
            ]}
          />
        </div>
        <div className="box box-shadow p-5">
          <h2 className="text-2xl">Margin</h2>
          <p className="hint mb-4">From orders where you have entered what they cost.</p>
          {m.ordersCosted === 0 ? (
            <p className="text-sm">No costs entered yet. Open an order and fill in &ldquo;What it cost us&rdquo; to see profit here.</p>
          ) : (
            <dl className="receipt p-4">
              <div className="row"><dt>Revenue ({m.ordersCosted} orders)</dt><dd className="num">{ghs(m.revenueMinor)}</dd></div>
              <div className="row"><dt>Costs</dt><dd className="num">{ghs(m.costMinor)}</dd></div>
              <hr />
              <div className="row total"><dt>Margin</dt><dd className={`num ${m.marginMinor < 0 ? "text-red" : ""}`}>{ghs(m.marginMinor)} · {pct(m.marginPct)}</dd></div>
            </dl>
          )}
          {m.ordersMissingCosts > 0 && <p className="mt-3 text-sm text-ink-soft">{m.ordersMissingCosts} paid order{m.ordersMissingCosts === 1 ? "" : "s"} still need costs entered, so they are not counted.</p>}
        </div>
      </section>

      {/* ---------------------------------------------------------------- rankings */}
      <section className="mb-10 grid gap-8 lg:grid-cols-3">
        <div className="box box-shadow p-5">
          <h2 className="text-xl">Top shops</h2>
          <div className="mt-4"><RankBars rows={shops.map((s) => ({ name: s.name, value: s.revenueMinor, sub: `${s.orders} orders · ${s.units} items` }))} format={ghs} /></div>
        </div>
        <div className="box box-shadow p-5">
          <h2 className="text-xl">Best-selling items</h2>
          <div className="mt-4"><RankBars rows={items.map((s) => ({ name: s.name, value: s.units, sub: `${ghs(s.revenueMinor)}` }))} format={(v) => `${v} sold`} /></div>
        </div>
        <div className="box box-shadow p-5">
          <h2 className="text-xl">Delivery areas</h2>
          <div className="mt-4"><RankBars rows={areas.map((a) => ({ name: a.name, value: a.orders, sub: ghs(a.revenueMinor) }))} format={(v) => `${v} orders`} /></div>
        </div>
      </section>

      {/* --------------------------------------------------- exchange rate + customers */}
      <section className="mb-10 grid gap-8 xl:grid-cols-[1.2fr_1fr]">
        <div id="rate" className="box box-shadow scroll-mt-24 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl">Exchange rate</h2>
              <p className="hint">Customers are quoted at this rate until you change it.</p>
            </div>
            <p className="display num text-3xl">£1 = GH₵{effectiveRate(settings.fx).toFixed(4)}</p>
          </div>
          {stale && (
            <p role="alert" className="box mt-4 border-red bg-red/10 p-3 text-sm font-semibold text-red">
              {age === null ? "You have not set the rate here yet." : `The rate was last set ${age} days ago.`} Check it against the market, because a stale rate costs money.
            </p>
          )}
          <div className="box mt-4 grid gap-3 bg-paper-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label">Market rate{market ? ` · ${market.provider}` : ""}</p>
                {market ? (
                  <p className="flex flex-wrap items-baseline gap-3">
                    <span className="display num text-2xl">£1 = GH₵{market.rate}</span>
                    {gap !== null && <span className={`mono text-sm font-semibold ${Math.abs(gap) * 100 >= policy.alertPct ? "text-red" : ""}`}>you are {Math.abs(gap * 100).toFixed(1)}% {gap > 0 ? "above" : gap < 0 ? "below" : "level with"} it</span>}
                  </p>
                ) : (
                  <p className="text-sm text-ink-soft">{feedOn ? "Not fetched yet." : "No rate feed is connected."} <Link href="/admin/integrations#rates-feed" className="link font-semibold">{feedOn ? "Fetch it" : "Connect one"}</Link></p>
                )}
                {market && <p className="hint">Fetched {market.fetchedAt.slice(0, 16).replace("T", " ")} UTC · mode: {policy.mode === "auto" ? "automatic" : policy.mode === "suggest" ? "suggest" : "manual"}</p>}
              </div>
              {feedOn && (
                <div className="flex flex-wrap gap-2">
                  <form action={refreshMarketRateAction}><input type="hidden" name="returnTo" value="/admin" /><button className="btn btn-small">Refresh</button></form>
                  {market && gap !== null && Math.abs(gap) >= 0.0005 && (
                    <form action={applyMarketRateAction}><input type="hidden" name="returnTo" value="/admin" /><button className="btn btn-small btn-gold">Use market rate</button></form>
                  )}
                </div>
              )}
            </div>
          </div>
          <form action={setRateAction} className="mt-4 grid gap-4">
            <input type="hidden" name="returnTo" value="/admin" />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="field">
                <label className="label" htmlFor="fxRate">GH₵ for £1</label>
                <input id="fxRate" name="fxRate" className="input" inputMode="decimal" defaultValue={settings.fx.rate} required />
              </div>
              <div className="field">
                <label className="label" htmlFor="fxMarkup">Markup (%)</label>
                <input id="fxMarkup" name="fxMarkup" className="input" inputMode="decimal" defaultValue={settings.fx.markupPct} required />
              </div>
              <div className="field">
                <label className="label" htmlFor="note">Note (optional)</label>
                <input id="note" name="note" className="input" placeholder="Why the change" maxLength={200} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button className="btn btn-primary">Update rate</button>
              <span className="hint">Existing orders keep the rate they were quoted. The markup covers movement before you buy.</span>
            </div>
          </form>
          {history.length > 0 && (
            <table className="table mt-5">
              <caption className="label mb-1 text-left">Recent changes</caption>
              <thead><tr><th>When (UTC)</th><th className="text-right">Rate</th><th className="text-right">Markup</th><th>Note</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}><td className="num whitespace-nowrap">{h.changedAt}</td><td className="num text-right">{h.rate}</td><td className="num text-right">{h.markupPct}%</td><td className="text-sm text-ink-soft">{h.note}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="grid content-start gap-8">
          <div className="box box-shadow p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl">Customers</h2>
              <Link href="/admin/customers" className="link text-sm font-semibold">All customers →</Link>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {([["Accounts", cust.accounts], [`New (${range} days)`, cust.newInRange], ["Have ordered", cust.withOrders], ["Repeat buyers", cust.repeat]] as const).map(([l, n]) => (
                <div key={l}><dt className="label">{l}</dt><dd className="display num text-3xl">{n}</dd></div>
              ))}
            </dl>
            {cust.disabled > 0 && <p className="mt-3 text-sm text-ink-soft">{cust.disabled} disabled account{cust.disabled === 1 ? "" : "s"}.</p>}
          </div>

          <div className="box box-shadow p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl">Integrations</h2>
              <Link href="/admin/integrations" className="link text-sm font-semibold">Set up →</Link>
            </div>
            <ul className="mt-3 grid gap-2 text-sm">
              {gateways.map((g) => (
                <li key={g.def.id} className="flex items-center justify-between gap-3">
                  <span>{g.def.name}</span>
                  {g.ready ? (g.on ? <span className="tag tag-green">Live</span> : <span className="tag tag-red">Off</span>) : <span className="tag">Not set up</span>}
                </li>
              ))}
              {channels.map((ch) => (
                <li key={ch.c} className="flex items-center justify-between gap-3">
                  <span>{CHANNEL_LABEL[ch.c]}{ch.def && <span className="label ml-2 normal-case">{ch.def.name}</span>}</span>
                  {ch.ready ? <span className="tag tag-green">Active</span> : <span className="tag">{ch.def ? "Not ready" : "Off"}</span>}
                </li>
              ))}
            </ul>
            <p className="hint mt-3">Messages in 7 days: {msgs.sent} sent, {msgs.failed} failed, {msgs.pending} waiting. <Link href="/admin/messages" className="link">View</Link></p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- recent activity + health */}
      <section className="mb-10 grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-8">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl">Latest orders</h2>
              <Link href="/admin/orders" className="link text-sm font-semibold">All orders →</Link>
            </div>
            {recent.length === 0 ? <p className="mt-3">No orders yet.</p> : (
              <div className="mt-3 overflow-x-auto">
                <table className="table table-cards">
                  <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="text-right">Total</th></tr></thead>
                  <tbody>
                    {recent.map((o) => (
                      <tr key={o.id}>
                        <td data-label=""><Link className="link mono" href={`/admin/orders/${o.id}`}>{o.number}</Link></td>
                        <td data-label="Customer">{o.customerName}</td>
                        <td data-label="Status"><StatusChip status={o.status} /></td>
                        <td data-label="Total" className="num text-right">{ghs(o.totalMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl">Recent admin activity</h2>
              <Link href="/admin/audit" className="link text-sm font-semibold">Full log →</Link>
            </div>
            {activity.length === 0 ? <p className="mt-3">Nothing recorded yet.</p> : (
              <ul className="mt-3 grid gap-2">
                {activity.map((a) => (
                  <li key={a.id} className="border-l border-line pl-3 text-sm">
                    <span className="font-semibold">{a.action}</span> · {a.target}{a.detail && <span className="text-ink-soft"> · {a.detail}</span>}
                    <span className="label num block">{a.at} UTC</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="box box-shadow h-fit p-5">
          <h2 className="text-xl">System checks</h2>
          <ul className="mt-3 grid gap-3">
            {health.map(([label, ok, why]) => (
              <li key={label} className="flex gap-3">
                <span aria-hidden="true" className={`mono mt-0.5 grid h-6 w-6 shrink-0 place-items-center font-semibold ${ok ? "bg-green text-paper" : "bg-red text-white"}`}>{ok ? "✓" : "!"}</span>
                <span className="text-sm">
                  <span className="block font-semibold">{label}<span className="sr-only">{ok ? ": ok" : ": needs attention"}</span></span>
                  {!ok && <span className="text-ink-soft">{why}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
