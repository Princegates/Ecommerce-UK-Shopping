import Link from "next/link";
import { toggleSourceAction } from "@/app/admin/ingest-actions";
import AddLinks from "@/components/admin/AddLinks";
import { Flash, PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { listShops } from "@/lib/catalog";
import { SOURCE_KINDS, listSources, type Source } from "@/lib/ingest/store";

export const dynamic = "force-dynamic";

function state(s: Source): { label: string; tone: string } {
  if (!s.termsConfirmedAt) return { label: "Needs permission", tone: "tag-gold" };
  if (s.runningSince) return { label: "Running", tone: "tag-green" };
  if (s.lastStatus === "BLOCKED") return { label: "Blocked by shop", tone: "tag-red" };
  if (s.lastStatus === "ERROR") return { label: "Failed", tone: "tag-red" };
  if (!s.enabled) return { label: "Off", tone: "" };
  return { label: "On", tone: "tag-green" };
}

export default async function SourcesAdmin({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const sources = listSources();
  const shops = listShops({ includeInactive: true }).map((s) => ({ id: s.id, name: s.name }));
  return (
    <>
      <PageHead title="Catalogue sources">
        <Link href="/admin/sources/new" className="btn btn-primary">Add a source</Link>
      </PageHead>
      <Flash saved={sp.saved} error={sp.error} />
      <p className="mb-6 max-w-3xl text-ink-soft">
        Sources fill the shops with products by themselves. Each one runs on its own schedule, publishes new items, keeps prices and stock
        current, and hides items that go stale. Add a product feed (best), a shop sitemap, or just paste links.
      </p>

      {sources.length === 0 ? (
        <p className="box mb-8 p-5">No sources yet. Add a feed or sitemap above, or paste a few product links below to start.</p>
      ) : (
        <div className="mb-10 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Source</th><th>Type</th><th>Status</th><th>Items</th><th>Last run</th><th></th></tr></thead>
            <tbody>
              {sources.map((s) => {
                const st = state(s);
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/sources/${s.id}`} className="link font-semibold">{s.name}</Link>
                      <span className="block text-xs text-ink-soft">{s.shopName}{s.urlDisplay ? ` · ${s.urlDisplay}` : ""}</span>
                    </td>
                    <td>{SOURCE_KINDS.find((k) => k.kind === s.kind)?.label ?? s.kind}</td>
                    <td><span className={`tag ${st.tone}`}>{st.label}</span>{s.pendingCount > 0 && <Link href="/admin/import" className="tag tag-gold ml-2">{s.pendingCount} to review</Link>}</td>
                    <td className="num">{s.itemCount}</td>
                    <td className="max-w-sm text-sm">{s.lastRunAt ? <>{s.lastRunAt.slice(0, 16)} UTC<span className="block text-ink-soft">{s.lastMessage}</span></> : "Never"}</td>
                    <td>
                      {s.termsConfirmedAt && (
                        <form action={toggleSourceAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="on" value={s.enabled ? "0" : "1"} />
                          <button className="btn btn-small">{s.enabled ? "Switch off" : "Switch on"}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddLinks shops={shops} />
    </>
  );
}
