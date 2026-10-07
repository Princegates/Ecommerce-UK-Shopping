import {
  clearFieldAction, saveIntegrationAction, testIntegrationAction, toggleIntegrationAction,
} from "@/app/admin/ops-actions";
import {
  CHANNEL_LABEL, isConfigured, keyMode, readyChannels, type Channel, type IntegrationConfig, type IntegrationDef,
} from "@/lib/integrations";
import { maskSecret } from "@/lib/secrets";

type Flash = { saved?: string; error?: string; test?: string; msg?: string; p?: string };

function StatusChip({ def, cfg }: { def: IntegrationDef; cfg: IntegrationConfig }) {
  const ready = readyChannels(def, cfg);
  if (ready.length === 0) return <span className="tag">Not set up</span>;
  if (!cfg.enabled) return <span className="tag tag-red">Switched off</span>;
  return <span className="tag tag-green">Ready</span>;
}

export default function IntegrationCard({
  def, cfg, flash, baseUrl, lastWebhook, testChannels,
}: {
  def: IntegrationDef;
  cfg: IntegrationConfig;
  flash: Flash;
  baseUrl: string | null;
  lastWebhook?: string | null;
  /** Channels the "send a test" form offers (messaging providers). Payments use a connection check. */
  testChannels: Channel[];
}) {
  const mode = keyMode(def.id, cfg.values);
  const mine = flash.p === def.id || flash.saved === def.id;
  const webhookUrl = def.webhook ? `${baseUrl ?? "https://YOUR-SITE"}${def.webhook.path}` : null;
  const isPayment = def.channels.includes("payments");
  const isRates = def.channels.includes("rates");
  const isCatalog = def.channels.includes("catalog");
  const checkChannel = isPayment ? "payments" : isCatalog ? "catalog" : "rates";
  const savedSecrets = def.fields.filter((f) => f.secret && cfg.sources[f.key] === "admin");

  return (
    <article id={def.id} className="box box-shadow scroll-mt-24">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
        <div>
          <h3 className="text-2xl">{def.name}</h3>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">{def.blurb}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode && <span className={`tag ${mode === "live" ? "tag-gold" : ""}`}>{mode === "live" ? "Live keys" : "Test keys"}</span>}
          <StatusChip def={def} cfg={cfg} />
          <form action={toggleIntegrationAction}>
            <input type="hidden" name="provider" value={def.id} />
            <input type="hidden" name="enabled" value={cfg.enabled ? "0" : "1"} />
            <button className="btn btn-small">{cfg.enabled ? "Switch off" : "Switch on"}</button>
          </form>
        </div>
      </header>

      <div className="grid gap-6 p-5">
        {mine && flash.error && <p role="alert" className="box border-red bg-red/10 p-3 font-semibold text-red">{flash.error}</p>}
        {flash.saved === def.id && <p role="status" className="box bg-gold/40 p-3 font-semibold">Saved.</p>}
        {flash.p === def.id && flash.test && (
          <p role="status" className={`box p-3 font-semibold ${flash.test === "ok" ? "bg-green/15" : "border-red bg-red/10 text-red"}`}>
            {flash.test === "ok" ? "Works. " : "Failed. "}{flash.msg}
          </p>
        )}

        {savedSecrets.length > 0 && (
          <div className="grid gap-2">
            <p className="label">Saved keys</p>
            {savedSecrets.map((f) => (
              <form key={f.key} action={clearFieldAction} className="flex flex-wrap items-center justify-between gap-3 border border-line px-3 py-2">
                <input type="hidden" name="provider" value={def.id} />
                <input type="hidden" name="key" value={f.key} />
                <span className="text-sm"><span className="font-semibold">{f.label}</span> <span className="mono ml-2">{maskSecret(cfg.values[f.key])}</span></span>
                <button className="link text-sm text-red">Remove</button>
              </form>
            ))}
          </div>
        )}

        <form action={saveIntegrationAction} className="grid gap-4">
          <input type="hidden" name="provider" value={def.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            {def.fields.map((f) => {
              const src = cfg.sources[f.key];
              const locked = src === "env";
              return (
                <div key={f.key} className="field">
                  <label className="label" htmlFor={`${def.id}-${f.key}`}>
                    {f.label}
                    {f.required && <span className="ml-1 text-red" aria-hidden="true">*</span>}
                  </label>
                  {f.options ? (
                    <select id={`${def.id}-${f.key}`} name={f.key} className="select" defaultValue={cfg.values[f.key] ?? f.default} disabled={locked}>
                      {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      id={`${def.id}-${f.key}`}
                      name={f.key}
                      className="input"
                      type={f.secret ? "password" : "text"}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={locked}
                      defaultValue={f.secret ? "" : cfg.values[f.key] ?? ""}
                      placeholder={locked ? "Managed by the server" : f.secret ? (src === "admin" ? "Paste a new value to replace" : f.placeholder ?? "") : f.default ?? f.placeholder ?? ""}
                    />
                  )}
                  {locked && <p className="hint">Set by the server environment ({f.env}); it cannot be changed here.</p>}
                  {src === "unreadable" && <p className="error-text text-sm">The saved value cannot be read because the encryption key changed. Paste it again.</p>}
                  {f.help && !locked && <p className="hint">{f.help}</p>}
                </div>
              );
            })}
          </div>
          <div><button className="btn btn-primary">Save {def.name}</button></div>
        </form>

        {webhookUrl && (
          <div className="grid gap-2 border-t-2 border-solid border-line pt-5">
            <p className="label">Webhook URL</p>
            <input readOnly value={webhookUrl} className="input mono text-sm" aria-label={`${def.name} webhook URL`} />
            <p className="hint">{def.webhook!.help}</p>
            {!baseUrl && <p className="error-text text-sm">Set APP_URL on the server so this shows your real address.</p>}
            {isPayment && <p className="hint">Last event received: {lastWebhook ? `${lastWebhook} UTC` : "none yet"}</p>}
          </div>
        )}

        <div className="grid gap-3 border-t-2 border-solid border-line pt-5">
          <p className="label">Check it works</p>
          {isPayment || isRates || isCatalog ? (
            <form action={testIntegrationAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="provider" value={def.id} />
              <input type="hidden" name="channel" value={checkChannel} />
              <button className="btn btn-small" disabled={!isConfigured(def, cfg, checkChannel)}>Test connection</button>
              <span className="hint">{isPayment ? `Makes one harmless call to ${def.name} with the saved keys. No money moves.` : isCatalog ? `Asks ${def.name} for a sign-in token to prove the keys work. Nothing is imported.` : `Fetches today's pound-to-cedi rate to prove the key works. Nothing is changed.`}</span>
            </form>
          ) : (
            <form action={testIntegrationAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="provider" value={def.id} />
              <div className="field">
                <label className="label" htmlFor={`${def.id}-ch`}>Channel</label>
                <select id={`${def.id}-ch`} name="channel" className="select !w-auto">
                  {testChannels.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="field min-w-56 flex-1">
                <label className="label" htmlFor={`${def.id}-to`}>Send a test message to</label>
                <input id={`${def.id}-to`} name="to" className="input" placeholder="024 123 4567 or you@example.com" autoComplete="off" />
              </div>
              <button className="btn btn-small">Send test</button>
            </form>
          )}
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Setup steps</summary>
          <ol className="mt-2 list-decimal pl-5">
            {def.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <p className="mt-2"><a href={def.docsUrl} target="_blank" rel="noopener noreferrer" className="link">{def.name} documentation ↗</a></p>
        </details>
      </div>
    </article>
  );
}
