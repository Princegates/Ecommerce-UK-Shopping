import { setReviewStatusAction } from "@/app/admin/ops-actions";
import { Flash, PageHead } from "@/components/admin/ui";
import Stars from "@/components/shop/Stars";
import { requireAdmin } from "@/lib/auth";
import { adminReviews } from "@/lib/reviews";

export default async function ReviewsAdmin({ searchParams }: { searchParams: Promise<{ status?: string; saved?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status === "PUBLISHED" || sp.status === "HIDDEN" ? sp.status : undefined;
  const reviews = adminReviews(status);
  const tabs: [string, string | undefined][] = [["All", undefined], ["Published", "PUBLISHED"], ["Hidden", "HIDDEN"]];
  return (
    <>
      <PageHead title="Reviews" />
      <Flash saved={sp.saved} />
      <p className="mb-4 max-w-2xl text-ink-soft">
        Only customers who received the item can leave a review. Hide anything abusive or off-topic; hidden reviews
        stop showing on the shop and no longer count towards ratings.
      </p>
      <nav className="mb-6 flex gap-2" aria-label="Filter reviews">
        {tabs.map(([label, v]) => (
          <a key={label} href={v ? `?status=${v}` : "?"} className={`btn btn-small ${v === status ? "btn-primary" : ""}`}>{label}</a>
        ))}
      </nav>
      {reviews.length === 0 ? (
        <p>No reviews yet.</p>
      ) : (
        <ul className="grid gap-4">
          {reviews.map((r) => (
            <li key={r.id} className={`box grid gap-3 p-4 md:grid-cols-[1fr_auto] ${r.status === "HIDDEN" ? "opacity-60" : ""}`}>
              <div>
                <p className="label">{r.productName} · {r.createdAt.slice(0, 10)} · {r.status.toLowerCase()}</p>
                <Stars value={r.rating} />
                <p className="mt-1 font-bold">{r.title}</p>
                <p className="whitespace-pre-line">{r.body}</p>
                <p className="mt-1 text-sm text-ink-soft">by {r.author}</p>
              </div>
              <form action={setReviewStatusAction} className="self-start">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="status" value={r.status === "HIDDEN" ? "PUBLISHED" : "HIDDEN"} />
                <button className="btn btn-small">{r.status === "HIDDEN" ? "Publish" : "Hide"}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
