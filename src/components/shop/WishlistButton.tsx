"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { toggleWishlistAction } from "@/app/actions/wishlist";

/** The heart. Saved items live in the shopper's account; visitors are asked to sign in first. */
export default function WishlistButton({ productId, saved, className = "" }: { productId: number; saved: boolean; className?: string }) {
  const path = usePathname();
  const qs = useSearchParams().toString();
  return (
    <form action={toggleWishlistAction} className={className}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="back" value={`${path}${qs ? `?${qs}` : ""}`} />
      <button className="icon-btn" aria-pressed={saved} aria-label={saved ? "Remove from saved items" : "Save this item"} title={saved ? "Saved" : "Save for later"}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.3 3 4.5 6.7 4.5c2 0 3.5 1 5.3 3 1.8-2 3.3-3 5.3-3 3.7 0 5.9 3.8 4.3 7.3C19.500 16.400 12 21 12 21z" />
        </svg>
      </button>
    </form>
  );
}
