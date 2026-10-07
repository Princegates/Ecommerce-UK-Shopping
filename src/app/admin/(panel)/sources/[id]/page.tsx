import Link from "next/link";
import { notFound } from "next/navigation";
import { runSourceNowAction, toggleSourceAction } from "@/app/admin/ingest-actions";
import SourceForm, { type SourceFormValues } from "@/components/admin/SourceForm";
import { Flash, PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { listShops } from "@/lib/catalog";
import { formatFieldMap } from "@/lib/ingest/field-map";
import { SOURCE_KINDS, getSource, listRuns } from "@/lib/ingest/store";

export const dynamic = "force-dynamic";

export default async function SourceDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string; started?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const shops = listShops({ includeInactive: true }).map((s) => ({ id: s.id, name: s.name }));
  const isNew = id === "new";
  const source = isNew ? null : getSource(Number(id));
  if (!isNew && !source) notFound();
  const runs = source ? listRuns(source.id) : [];

  const values: SourceFormValues = source
    ? {
        id: source.id, shopId: source.shopId, name: source.name, kind: source.kind, urlDisplay: source.urlDisplay, fieldMapText: source.kind === "ebay" ? (source.fieldMap.queries ?? "") : formatFieldMap(source.fieldMap),
        termsUrl: source.termsUrl, termsNote: source.termsNote, termsConfirmedAt: source.termsConfirmedAt, enabled: source.enabled, autoPublishNew: source.autoPublishNew,
        autoApplyUpdates: source.autoApplyUpdates, maxPriceChangePct: source.maxPriceChangePct, maxItems: source.maxItems, delaySeconds: source.delayMs / 1000,
        intervalHours: source.intervalHours, staleDays: source.staleDays, defaultCategory: source.defaultCategory, defaultWeightGrams: source.defaultWeightGrams,
      }
    : {
        id: 0, shopId: shops[0]?.id ?? 0, name: "", kind: "feed_csv", urlDisplay: "", fieldMapText: "", termsUrl: "", termsNote: "", termsConfirmedAt: null, enabled: true,
        autoPublishNew: true, autoApplyUpdates: true, maxPriceChangePct: 40, maxItems: 50, delaySeconds: 3, intervalHours: 24, staleDays: 14, defaultCategory: "", defaultWeightGrams: 500,
      };

  return (
    <>
      <PageHead title={source ? source.name : "New source"}>
        <Link href="/admin/sources" className="link">All sources</Link>
      </PageHead>
      <Flash saved={sp.saved} error={sp.error} />
      {sp.started && <p role="status" className="box mb-6 bg-gold/40 p-3 font-semibold">Run started. Refresh in a minute to see the result below.</p>}

      {source && (
        <section className="box box-shadow mb-8 grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-bold">
              {source.runningSince ? "Running now" : source.lastStatus === "BLOCKED" ? "Blocked by the shop" : source.lastStatus === "ERROR" ? "Last run failed" : source.enabled ? "On, runs every " + source.intervalHours + " h" : "Off"}
            </p>
            {source.lastMessage && <p className="text-ink-soft">{source.lastMessage}</p>}
            {source.pausedUntil && <p className="text-sm text-red">Paused until {source.pausedUntil} UTC. Switching the source off and on again clears the pause.</p>}
            <p className="mt-1 text-sm text-ink-soft">{source.itemCount} items read{source.pendingCount ? ` · ${source.pendingCount} waiting in Import review` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={runSourceNowAction}>
              <input type="hidden" name="id" value={source.id} />
              <button className="btn btn-primary" disabled={!source.termsConfirmedAt}>Run now</button>
            </form>
            {source.termsConfirmedAt && (
              <form action={toggleSourceAction}>
                <input type="hidden" name="id" value={source.id} />
                <input type="hidden" name="on" value={source.enabled ? "0" : "1"} />
                <input type="hidden" name="return" value="detail" />
                <button className="btn">{source.enabled ? "Switch off" : "Switch on"}</button>
              </form>
            )}
          </div>
        </section>
      )}

      <SourceForm v={values} shops={shops} kinds={SOURCE_KINDS} />

      {runs.length > 0 && (
        <section className="mt-10" aria-labelledby="runs-h">
          <h2 id="runs-h" className="mb-3 text-2xl">Recent runs</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Started (UTC)</th><th>Result</th><th className="text-right">Read</th><th className="text-right">New</th><th className="text-right">Updated</th><th className="text-right">Held</th><th className="text-right">Removed</th><th>Notes</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="num whitespace-nowrap">{r.startedAt.slice(0, 16)}</td>
                    <td><span className={`tag ${r.status === "OK" ? "tag-green" : r.status === "RUNNING" ? "" : "tag-red"}`}>{r.status.toLowerCase()}</span></td>
                    <td className="num text-right">{r.fetched}</td><td className="num text-right">{r.created}</td><td className="num text-right">{r.updated}</td>
                    <td className="num text-right">{r.held}</td><td className="num text-right">{r.removed}</td>
                    <td className="max-w-md text-sm text-ink-soft">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
