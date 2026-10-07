import Link from "next/link";
import type { Customer } from "@/lib/customers";
import { listReviews, ratingSummary, reviewEligibility } from "@/lib/reviews";
import ReviewForm from "./ReviewForm";
import Stars from "./Stars";

/** Ratings and reviews. Only people who received the item can write one, and it is marked as such. */
export default function Reviews({ productId, slug, customer }: { productId: number; slug: string; customer: Customer | null }) {
  const sum = ratingSummary(productId);
  const reviews = listReviews(productId, 30);
  const elig = customer ? reviewEligibility(customer.id, productId) : null;

  return (
    <section id="reviews" aria-labelledby="reviews-h" className="scroll-mt-40">
      <h2 id="reviews-h" className="text-3xl">Ratings and reviews</h2>
      <div className="mt-5 grid gap-8 md:grid-cols-[16rem_1fr]">
        <div>
          {sum.count === 0 ? (
            <p className="text-ink-soft">No reviews yet. Be the first once you have received this item.</p>
          ) : (
            <>
              <p className="flex items-baseline gap-2"><span className="display num text-3xl">{sum.average}</span><span className="text-ink-soft">out of 5</span></p>
              <Stars value={sum.average} count={sum.count} size={20} />
              <ul className="mt-4 grid gap-1.5" aria-label="Ratings breakdown">
                {([5, 4, 3, 2, 1] as const).map((n) => (
                  <li key={n} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2 text-sm">
                    <span className="num">{n} ★</span>
                    <span className="h-3 border border-line bg-paper-2" aria-hidden="true"><span className="block h-full bg-gold" style={{ width: `${(sum.counts[n] / sum.count) * 100}%` }} /></span>
                    <span className="num text-right">{sum.counts[n]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-6">
            {!customer && <p className="text-sm"><Link href={`/login?next=${encodeURIComponent(`/products/${slug}`)}`} className="link font-semibold">Sign in</Link> to review items you have received.</p>}
            {elig === "not-purchased" && <p className="text-sm text-ink-soft">You can review this item once your order for it has been delivered.</p>}
            {elig === "already" && <p className="text-sm font-semibold">You have reviewed this item. Thank you.</p>}
          </div>
        </div>

        <div className="grid content-start gap-5">
          {elig === "yes" && <ReviewForm productId={productId} />}
          {reviews.map((r) => (
            <article key={r.id} className="border-b border-line pb-5">
              <div className="flex flex-wrap items-center gap-3">
                <Stars value={r.rating} size={16} />
                {r.title && <h3 className="!text-lg">{r.title}</h3>}
              </div>
              <p className="mt-1 text-sm"><span className="font-semibold">{r.author}</span> <span className="tag tag-green ml-2">Verified purchase</span> <span className="label num ml-2">{r.createdAt.slice(0, 10)}</span></p>
              {r.body && <p className="mt-2 max-w-2xl whitespace-pre-line">{r.body}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
