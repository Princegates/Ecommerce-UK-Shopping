import Link from "next/link";
import { approveItemAction, approveManyAction, rejectItemAction } from "@/app/admin/ingest-actions";
import { Flash, PageHead } from "@/components/admin/ui";
import PhotoImg from "@/components/PhotoImg";
import { requirePermission } from "@/lib/auth";
import { listImportItems, listSources, type ImportItem } from "@/lib/ingest/store";
import { gbp } from "@/lib/money";

export const dynamic = "force-dynamic";

const TABS: [string, string][] = [["Needs review", "REVIEW"], ["Live", "PUBLISHED"], ["Rejected", "REJECTED"]];
const PAGE = 50;

const noImage = <span className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-line text-xs text-ink-soft">No photo</span>;

export default async function ImportReview({ searchParams }: { searchParams: Promise<{ status?: string; source?: string; page?: string; saved?: string; error?: string }> }) {
  await requirePermission("import.review");
  const sp = await searchParams;
  const status = (TABS.find(([, v]) => v === sp.status)?.[1] ?? "REVIEW") as ImportItem["status"] | "REVIEW";
  const sourceId = Number(sp.source) || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = listImportItems({ status, sourceId, limit: PAGE, offset: (page - 1) * PAGE });
  const sources = listSources();
  const qs = (o: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: sp.status, source: sp.source, ...o })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `?${s}` : "";
  };
  const here = `/admin/import${qs({})}`;

  return (
    <>
      <PageHead title="Import review" />
      <Flash saved={sp.saved} error={sp.error} />
      <p className="mb-4 max-w-3xl text-ink-soft">
        Most imported items go live by themselves. Items land here when something looks off: an unusual price, a big price jump, or a source
        you set to approve by hand. Approve to put the item (or its new price) on the site.
      </p>
      <nav className="mb-4 flex flex-wrap items-center gap-2" aria-label="Filter">
        {TABS.map(([label, v]) => (
          <Link key={v} href={`/admin/import${qs({ status: v, page: undefined })}`} className={`btn btn-small ${v === status ? "btn-primary" : ""}`}>{label}</Link>
        ))}
        <span className="mx-2 text-ink-soft">·</span>
        <Link href={`/admin/import${qs({ source: undefined, page: undefined })}`} className={`btn btn-small ${!sourceId ? "btn-primary" : ""}`}>All sources</Link>
        {sources.filter((s) => s.itemCount > 0).map((s) => (
          <Link key={s.id} href={`/admin/import${qs({ source: String(s.id), page: undefined })}`} className={`btn btn-small ${sourceId === s.id ? "btn-primary" : ""}`}>{s.name}</Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="box p-5">{status === "REVIEW" ? "Nothing needs review. Imports are flowing." : "Nothing here."}</p>
      ) : (
        <form action={approveManyAction} className="grid gap-3">
          <input type="hidden" name="return" value={here} />
          <div className="flex flex-wrap items-center gap-2">
            {status !== "PUBLISHED" && <button name="decision" value="approve" className="btn btn-small btn-primary">Approve selected</button>}
            {status !== "REJECTED" && <button name="decision" value="reject" className="btn btn-small">Reject selected</button>}
            <span className="hint">{total} item{total === 1 ? "" : "s"}{total > PAGE ? `, showing ${(page - 1) * PAGE + 1} to ${Math.min(total, page * PAGE)}` : ""}</span>
          </div>
          <ul className="grid gap-3">
            {items.map((it) => (
              <li key={it.id} className={`box grid gap-3 p-4 md:grid-cols-[auto_5rem_1fr_auto] md:items-center ${it.status === "HELD" ? "!bg-gold/25" : ""}`}>
                <input type="checkbox" name="ids" value={it.id} aria-label={`Select ${it.name}`} className="h-5 w-5 accent-[var(--green)]" />
                {it.imageUrl ? <PhotoImg src={it.imageUrl} alt="" className="h-20 w-20 rounded-lg border border-line object-contain" fallback={noImage} /> : noImage}
                <div className="min-w-0">
                  <p className="label">{it.shopName} · {it.sourceName}</p>
                  <p className="font-bold">{it.name}</p>
                  <p className="num">
                    {it.status === "HELD" && it.productPriceMinor !== null && it.productPriceMinor !== it.priceMinor ? <><span className="was">{gbp(it.productPriceMinor)}</span> → <strong>{gbp(it.priceMinor)}</strong></> : <strong>{gbp(it.priceMinor)}</strong>}
                    {it.compareAtMinor ? <span className="was ml-2">{gbp(it.compareAtMinor)}</span> : null}
                    <span className="ml-3 text-sm text-ink-soft">{it.inStock ? "In stock" : "Out of stock"}{it.category ? ` · ${it.category}` : ""}</span>
                  </p>
                  {it.holdReason && <p className="text-sm font-semibold text-red">{it.holdReason}</p>}
                  {it.productUrl && <a href={it.productUrl} target="_blank" rel="noopener noreferrer nofollow" className="link break-all text-sm">View at the shop ↗</a>}
                </div>
                <div className="flex gap-2">
                  {it.status !== "PUBLISHED" && <button formAction={approveItemAction} name="id" value={it.id} className="btn btn-small btn-primary">Approve</button>}
                  {it.status !== "REJECTED" && <button formAction={rejectItemAction} name="id" value={it.id} className="btn btn-small">Reject</button>}
                </div>
              </li>
            ))}
          </ul>
          {total > PAGE && (
            <div className="flex gap-3">
              {page > 1 && <Link className="link" href={`/admin/import${qs({ page: String(page - 1) })}`}>← Newer</Link>}
              {page * PAGE < total && <Link className="link" href={`/admin/import${qs({ page: String(page + 1) })}`}>Older →</Link>}
            </div>
          )}
        </form>
      )}
    </>
  );
}
