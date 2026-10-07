import { refreshMarketRateAction, saveFxPolicyAction, saveNotifyRulesAction, setChannelAction } from "@/app/admin/ops-actions";
import { PageHead } from "@/components/admin/ui";
import IntegrationCard from "@/components/admin/IntegrationCard";
import { appUrl } from "@/lib/app-url";
import { getFxPolicy, getMarketRate } from "@/lib/fx-api";
import { requireAdmin } from "@/lib/auth";
import {
  CHANNEL_LABEL, getChannelProviderId, isConfigured, providersFor, readConfig, type Channel, type IntegrationDef,
} from "@/lib/integrations";
import { MESSAGE_CHANNELS, getRules, messageStats } from "@/lib/notify/outbox";
import { ORDER_STATUSES, STATUS_LABEL } from "@/lib/order-status";
import { demoPaymentsEnabled } from "@/lib/payments";
import { lastWebhookAt } from "@/lib/payments/confirm";
import { encryptionPassphrase } from "@/lib/secrets";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; test?: string; msg?: string; p?: string }>;
}) {
  await requireAdmin();
  const flash = await searchParams;
  const base = appUrl();
  const payments = providersFor("payments");
  const messaging: IntegrationDef[] = [];
  for (const c of MESSAGE_CHANNELS) for (const p of providersFor(c)) if (!messaging.some((m) => m.id === p.id)) messaging.push(p);
  const rules = getRules();
  const rateProviders = providersFor("rates");
  const chosenRates = getChannelProviderId("rates");
  const ratesDef = rateProviders.find((p) => p.id === chosenRates);
  const ratesReady = ratesDef ? (() => { const cfg = readConfig(ratesDef); return cfg.enabled && isConfigured(ratesDef, cfg, "rates"); })() : false;
  const policy = getFxPolicy();
  const market = getMarketRate();
  const stats = messageStats(7);
  const canStoreKeys = encryptionPassphrase() !== null;
  const production = process.env.NODE_ENV === "production";
  const activeGateways = payments.filter((p) => {
    const cfg = readConfig(p);
    return cfg.enabled && isConfigured(p, cfg, "payments");
  });

  const checks: [string, boolean, string][] = [
    ["Public address (APP_URL)", base !== null && (!production || base.startsWith("https://")), "Needed for payment return links and message links. Use https in production."],
    ["Key encryption", canStoreKeys, "Set SETTINGS_ENCRYPTION_KEY (or ADMIN_SECRET) so keys can be saved. Saved keys are encrypted."],
    ["A payment gateway is switched on", activeGateways.length > 0 || demoPaymentsEnabled(), "Customers cannot pay online until one is set up."],
    ["Demo payments are off in production", !(production && demoPaymentsEnabled()), "Demo payments move no money. Remove ALLOW_DEMO_PAYMENTS."],
  ];

  return (
    <>
      <PageHead title="Integrations" />
      <p className="mb-6 max-w-3xl text-ink-soft">
        Every outside service the shop uses is set up here: payment gateways, SMS, WhatsApp and email. Keys you save are
        encrypted and never shown again, only the last four characters. Anything set on the server is shown as locked.
      </p>

      <section aria-labelledby="ready-h" className="box box-shadow mb-10 grid gap-3 p-5">
        <h2 id="ready-h" className="text-2xl">Readiness</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {checks.map(([label, ok, why]) => (
            <li key={label} className="flex gap-3">
              <span aria-hidden="true" className={`mono mt-0.5 grid h-6 w-6 shrink-0 place-items-center font-semibold ${ok ? "bg-green text-paper" : "bg-red text-white"}`}>{ok ? "✓" : "!"}</span>
              <span>
                <span className="block font-semibold">{label}<span className="sr-only">{ok ? ": ok" : ": needs attention"}</span></span>
                {!ok && <span className="text-sm text-ink-soft">{why}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="hint">Messages in the last 7 days: {stats.sent} sent, {stats.failed} failed, {stats.pending} waiting.</p>
      </section>

      <section id="payments" aria-labelledby="pay-h" className="mb-12 scroll-mt-24">
        <h2 id="pay-h" className="text-3xl">Payment gateways</h2>
        <p className="mt-1 max-w-3xl text-ink-soft">
          Customers choose from the gateways that are set up and switched on. Orders are only marked paid after the
          gateway confirms the right amount.
        </p>
        <div className="mt-6 grid gap-8">
          {payments.map((def) => (
            <IntegrationCard key={def.id} def={def} cfg={readConfig(def)} flash={flash} baseUrl={base} lastWebhook={lastWebhookAt(def.id)} testChannels={[]} />
          ))}
        </div>
      </section>

      <section id="channels" aria-labelledby="chan-h" className="mb-12 scroll-mt-24">
        <h2 id="chan-h" className="text-3xl">Messaging channels</h2>
        <p className="mt-1 max-w-3xl text-ink-soft">Choose which provider sends each kind of message. Set the providers up below first.</p>
        <ul className="mt-6 grid gap-4 lg:grid-cols-3">
          {MESSAGE_CHANNELS.map((channel) => {
            const chosen = getChannelProviderId(channel);
            const def = providersFor(channel).find((p) => p.id === chosen);
            const ready = def ? (() => { const cfg = readConfig(def); return cfg.enabled && isConfigured(def, cfg, channel); })() : false;
            return (
              <li key={channel} className="box box-shadow grid content-start gap-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-2xl">{CHANNEL_LABEL[channel]}</h3>
                  {ready ? <span className="tag tag-green">Active</span> : <span className="tag">{def ? "Not ready" : "Off"}</span>}
                </div>
                <form action={setChannelAction} className="grid gap-3">
                  <input type="hidden" name="channel" value={channel} />
                  <div className="field">
                    <label className="label" htmlFor={`ch-${channel}`}>Provider</label>
                    <select id={`ch-${channel}`} name="provider" className="select" defaultValue={chosen ?? ""}>
                      <option value="">None (do not send)</option>
                      {providersFor(channel).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-small w-fit">Save</button>
                </form>
                {flash.saved === `channel-${channel}` && <p role="status" className="text-sm font-semibold">Saved.</p>}
                {def && !ready && <p className="hint">Finish setting up {def.name} below and switch it on.</p>}
              </li>
            );
          })}
        </ul>
        <div className="mt-8 grid gap-8">
          {messaging.map((def) => (
            <IntegrationCard key={def.id} def={def} cfg={readConfig(def)} flash={flash} baseUrl={base} testChannels={def.channels.filter((c): c is Channel => c !== "payments")} />
          ))}
        </div>
      </section>

      <section id="rates-feed" aria-labelledby="rates-h" className="mb-12 scroll-mt-24">
        <h2 id="rates-h" className="text-3xl">Exchange rate feed</h2>
        <p className="mt-1 max-w-3xl text-ink-soft">
          Pulls the live pound-to-cedi market rate. You stay in charge: customers are quoted at the rate and markup set on
          your dashboard, and the feed only helps you keep it current.
        </p>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="box box-shadow grid content-start gap-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-2xl">Source</h3>
              {ratesReady ? <span className="tag tag-green">Active</span> : <span className="tag">{ratesDef ? "Not ready" : "Off"}</span>}
            </div>
            <form action={setChannelAction} className="grid gap-3">
              <input type="hidden" name="channel" value="rates" />
              <div className="field">
                <label className="label" htmlFor="ch-rates">Rate provider</label>
                <select id="ch-rates" name="provider" className="select" defaultValue={chosenRates ?? ""}>
                  <option value="">None (set the rate by hand)</option>
                  {rateProviders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <button className="btn btn-small w-fit">Save</button>
            </form>
            {flash.saved === "channel-rates" && <p role="status" className="text-sm font-semibold">Saved.</p>}
            <div className="border-t-2 border-solid border-line pt-4">
              <p className="label">Latest market rate</p>
              {market ? (
                <p className="mt-1"><span className="display num text-2xl">£1 = GH₵{market.rate}</span> <span className="hint">from {market.provider}, fetched {market.fetchedAt.slice(0, 16).replace("T", " ")} UTC</span></p>
              ) : <p className="hint mt-1">Not fetched yet.</p>}
              <form action={refreshMarketRateAction} className="mt-3">
                <input type="hidden" name="returnTo" value="/admin/integrations" />
                <button className="btn btn-small" disabled={!ratesReady}>Fetch the market rate now</button>
              </form>
            </div>
          </div>

          <form action={saveFxPolicyAction} className="box box-shadow grid content-start gap-4 p-5">
            <h3 className="text-2xl">How the rate is kept up to date</h3>
            {flash.saved === "fx-policy" && <p role="status" className="box bg-gold/40 p-3 font-semibold">Saved.</p>}
            <fieldset className="grid gap-2">
              <legend className="sr-only">Mode</legend>
              {([
                ["manual", "I set the rate myself", "The market rate is not used. You will not be alerted if it moves."],
                ["suggest", "Show me the market rate", "The dashboard shows the market rate and warns you when yours drifts. You press a button to use it."],
                ["auto", "Update it automatically", "A scheduled job sets the base rate to the market rate when the move is within your limit. Bigger moves wait for you."],
              ] as const).map(([v, t, h]) => (
                <label key={v} className={`box flex cursor-pointer items-start gap-3 p-3 ${policy.mode === v ? "!bg-gold/40" : ""}`}>
                  <input type="radio" name="mode" value={v} defaultChecked={policy.mode === v} className="mt-1 h-4 w-4 accent-[var(--green)]" />
                  <span><span className="block font-semibold">{t}</span><span className="hint">{h}</span></span>
                </label>
              ))}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="maxChangePct">Largest automatic change (%)</label>
                <input id="maxChangePct" name="maxChangePct" className="input" inputMode="decimal" defaultValue={policy.maxChangePct} />
                <p className="hint">A feed glitch or a sudden swing will not reprice the shop on its own.</p>
              </div>
              <div className="field">
                <label className="label" htmlFor="alertPct">Warn me when I am off by (%)</label>
                <input id="alertPct" name="alertPct" className="input" inputMode="decimal" defaultValue={policy.alertPct} />
              </div>
            </div>
            <p className="hint">Automatic updates need a scheduler to call <span className="mono">/api/cron/fx</span> with your CRON_SECRET, once or twice a day. The markup you set is always kept.</p>
            <div><button className="btn btn-primary">Save</button></div>
          </form>
        </div>
        <div className="mt-8 grid gap-8">
          {rateProviders.map((def) => (
            <IntegrationCard key={def.id} def={def} cfg={readConfig(def)} flash={flash} baseUrl={base} testChannels={[]} />
          ))}
        </div>
      </section>

      <section id="rules" aria-labelledby="rules-h" className="scroll-mt-24">
        <h2 id="rules-h" className="text-3xl">Which updates are sent</h2>
        <p className="mt-1 max-w-3xl text-ink-soft">
          Tick the channels used for each order update. A message is only sent if the customer has allowed that channel and
          the channel has a working provider. WhatsApp always needs the customer&rsquo;s opt-in.
        </p>
        {flash.saved === "rules" && <p role="status" className="box mt-4 bg-gold/40 p-3 font-semibold">Saved.</p>}
        <form action={saveNotifyRulesAction} className="box box-shadow mt-6 overflow-x-auto p-5">
          <table className="table">
            <thead>
              <tr><th>When the order becomes</th>{MESSAGE_CHANNELS.map((c) => <th key={c} className="text-center">{CHANNEL_LABEL[c]}</th>)}</tr>
            </thead>
            <tbody>
              {ORDER_STATUSES.map((s) => (
                <tr key={s}>
                  <td className="font-semibold">{STATUS_LABEL[s]}</td>
                  {MESSAGE_CHANNELS.map((c) => (
                    <td key={c} className="text-center">
                      <input type="checkbox" name={`rule:${s}:${c}`} defaultChecked={rules[s][c]} className="h-5 w-5 accent-[var(--green)]" aria-label={`${STATUS_LABEL[s]} by ${CHANNEL_LABEL[c]}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4"><button className="btn btn-primary">Save rules</button></div>
        </form>
      </section>
    </>
  );
}
