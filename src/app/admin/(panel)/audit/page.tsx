import { PageHead } from "@/components/admin/ui";
import { recentAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("audit.view");
  const { q } = await searchParams;
  const rows = recentAudit(300, q);
  return (
    <>
      <PageHead title="Activity log" />
      <p className="mb-6 max-w-3xl text-ink-soft">A record of changes made in this admin area: prices, rates, keys, statuses and more. Keys themselves are never recorded.</p>
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <div className="field">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="e.g. rate, stripe, order" />
        </div>
        <button className="btn">Search</button>
      </form>
      {rows.length === 0 ? (
        <p>Nothing recorded {q ? "for that search" : "yet"}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>When (UTC)</th><th>Who</th><th>Action</th><th>What</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num whitespace-nowrap">{r.at}</td>
                  <td>{r.actor}</td>
                  <td className="mono text-sm">{r.action}</td>
                  <td>{r.target}</td>
                  <td className="text-sm text-ink-soft">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
