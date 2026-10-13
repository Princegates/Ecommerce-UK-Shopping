import { getFxHealth, getSourceErrors } from "@/lib/fx-api";
import { SOURCE_LABEL, type SourceId } from "@/lib/fx-sources";
import { getSettings } from "@/lib/settings";

const CUSTOMS_TEXT = { manual: "the figure you set by hand", bank_of_ghana: "the Bank of Ghana's official rate", market: "the market rate (no fresh Bank of Ghana rate yet)" } as const;

/** Every exchange-rate source with its latest reading, how far apart they are, and whether new quotes are on hold. */
export default function FxSourcesPanel() {
  const health = getFxHealth();
  const errors = getSourceErrors();
  const s = getSettings();
  const ids = Object.keys(SOURCE_LABEL) as SourceId[];
  const byId = new Map(health.sources.map((x) => [x.id, x]));
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  return (
    <div className="grid gap-3">
      {health.frozen && (
        <p role="alert" className="box border-red bg-red/10 p-3 font-semibold text-red">
          New quotes are on hold: the sources are {pct(health.spread ?? 0)} apart, more than the {pct(health.limit)} allowed.
          Customers cannot place new orders until they agree again. Prices already held for a shopper still stand.
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left"><th className="py-1 pr-2">Source</th><th className="py-1 pr-2">£1 =</th><th className="py-1 pr-2">Read</th></tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const r = byId.get(id);
            return (
              <tr key={id} className="border-t border-line align-top">
                <td className="py-1.5 pr-2 font-semibold">{SOURCE_LABEL[id]}</td>
                <td className="num py-1.5 pr-2">{r ? `GH₵${r.rate}` : "—"}</td>
                <td className="py-1.5 pr-2">
                  {r ? <>{r.ageHours < 1 ? "just now" : `${Math.round(r.ageHours)} h ago`}{!r.fresh && <span className="tag ml-2">stale</span>}</> : <span className="text-ink-soft">not read yet</span>}
                  {errors[id] && <span className="error-text block">{errors[id]}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint">
        {health.spread === null ? "Fewer than two fresh sources, so there is nothing to compare." : `The widest gap between fresh sources is ${pct(health.spread)} (new quotes are held above ${pct(health.limit)}).`}
        {" "}Customs values import duty at {CUSTOMS_TEXT[s.customsSource]}: GH₵{s.market.customs}.
      </p>
    </div>
  );
}
