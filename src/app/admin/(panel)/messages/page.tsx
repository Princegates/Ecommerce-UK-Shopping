import Link from "next/link";
import { retryMessageAction, sendQueuedNowAction } from "@/app/admin/ops-actions";
import { PageHead } from "@/components/admin/ui";
import { can, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { messageStats, recentMessages } from "@/lib/notify/outbox";

const STATUSES = ["PENDING", "SENT", "FAILED"] as const;

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ status?: string; saved?: string; ran?: string }> }) {
  const who = await requirePermission("messages.view");
  const canManage = can(who, "messages.manage");
  const sp = await searchParams;
  const filter = STATUSES.find((s) => s === sp.status);
  const all = recentMessages(200);
  const rows = filter ? all.filter((m) => (filter === "PENDING" ? m.status === "PENDING" || m.status === "SENDING" : m.status === filter)) : all;
  const stats = messageStats(7);
  const total = (db().prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number }).n;

  return (
    <>
      <PageHead title="Messages">
        {canManage && <form action={sendQueuedNowAction}><button className="btn btn-primary">Send queued messages now</button></form>}
      </PageHead>
      <p className="mb-6 max-w-3xl text-ink-soft">
        Every SMS, WhatsApp message and email the shop sends to customers. Failed messages are tried three times, then wait
        here for you. Recipients are partly hidden.
      </p>
      {sp.ran && <p role="status" className="box mb-4 bg-gold/40 p-3 font-semibold">Done: {sp.ran}.</p>}
      {sp.saved && <p role="status" className="box mb-4 bg-gold/40 p-3 font-semibold">Queued for another try.</p>}

      <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Sent (7 days)", stats.sent], ["Failed (7 days)", stats.failed], ["Waiting", stats.pending], ["All time", total]] as const).map(([l, n]) => (
          <li key={l} className="box p-4"><p className="label">{l}</p><p className="display num text-3xl">{n}</p></li>
        ))}
      </ul>

      <nav aria-label="Filter" className="mb-4 flex gap-2">
        <Link href="/admin/messages" className={`tag !px-3 !py-1.5 ${!filter ? "!bg-ink !text-paper" : ""}`}>All</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/messages?status=${s}`} className={`tag !px-3 !py-1.5 ${filter === s ? "!bg-ink !text-paper" : ""}`}>{s.toLowerCase()}</Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p>No messages {filter ? "in this view" : "yet"}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>When</th><th>Order</th><th>Channel</th><th>To</th><th>Update</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="num whitespace-nowrap">{m.createdAt.slice(5, 16)}</td>
                  <td className="mono">{m.orderNumber ?? "—"}</td>
                  <td>{m.channel}{m.provider && <span className="label block">{m.provider}</span>}</td>
                  <td className="mono text-sm">{m.recipient}</td>
                  <td>{m.event.toLowerCase().replace(/_/g, " ")}</td>
                  <td>
                    <span className={`tag ${m.status === "SENT" ? "tag-green" : m.status === "FAILED" ? "tag-red" : ""}`}>{m.status.toLowerCase()}</span>
                    {m.attempts > 0 && m.status !== "SENT" && <span className="label ml-2">try {m.attempts}</span>}
                    {m.error && <p className="mt-1 max-w-xs text-xs text-red">{m.error}</p>}
                  </td>
                  <td>
                    {canManage && m.status === "FAILED" && (
                      <form action={retryMessageAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="btn btn-small">Retry</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
