"use client";

import { useActionState } from "react";
import { addReviewAction, type ReviewState } from "@/app/actions/reviews";

export default function ReviewForm({ productId }: { productId: number }) {
  const [s, action, pending] = useActionState<ReviewState, FormData>(addReviewAction, {});
  if (s.done) return <p role="status" className="box bg-gold/40 p-4 font-semibold">Thank you. Your review is live.</p>;
  return (
    <form action={action} className="box grid gap-4 p-5">
      <input type="hidden" name="productId" value={productId} />
      <h3 className="text-xl">Write a review</h3>
      <fieldset>
        <legend className="label mb-1 text-ink">Your rating</legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="pill"><input type="radio" name="rating" value={n} required /><span>{n} ★</span></label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label className="label" htmlFor="rv-title">Headline</label>
        <input id="rv-title" name="title" className="input" maxLength={100} />
      </div>
      <div className="field">
        <label className="label" htmlFor="rv-body">Your review</label>
        <textarea id="rv-body" name="body" className="textarea" maxLength={2000} placeholder="Fit, quality, packaging, delivery…" />
      </div>
      {s.error && <p role="alert" className="error-text">{s.error}</p>}
      <div><button className="btn btn-primary" disabled={pending}>{pending ? "Posting…" : "Post review"}</button></div>
    </form>
  );
}
