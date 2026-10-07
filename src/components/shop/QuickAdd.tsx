"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { addToCartAction, type AddState } from "@/app/actions/cart";

/** Add straight from a card when the item has no choices to make; otherwise go to the item page. */
export default function QuickAdd({ productId, slug, hasOptions }: { productId: number; slug: string; hasOptions: boolean }) {
  const [state, action, pending] = useActionState<AddState, FormData>(addToCartAction, {});
  useEffect(() => {
    if (state.added) window.dispatchEvent(new Event("cart:added"));
  }, [state.added, state.nonce]);

  if (hasOptions) return <Link href={`/products/${slug}`} className="btn btn-small w-full ">Choose options</Link>;
  return (
    <form action={action} className="grid gap-1">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value="1" />
      <button key={state.nonce ?? 0} className={`btn btn-small btn-gold w-full ${state.added ? "pop" : ""}`} disabled={pending}>{pending ? "Adding…" : state.added ? "Added ✓ Add another" : "Add to cart"}</button>
      <span className="sr-only" role="status">{state.added ? "Added to your cart" : ""}</span>
      {state.error && <span className="error-text text-xs" role="alert">{state.error}</span>}
    </form>
  );
}
