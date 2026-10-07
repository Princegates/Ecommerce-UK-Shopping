import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { requireCustomer } from "@/lib/customer-session";
import { getShopper } from "@/lib/shopper";
import { listWishlist } from "@/lib/wishlist";

export const metadata: Metadata = { title: "Saved items" };

export default async function WishlistPage() {
  const c = await requireCustomer("/account/wishlist");
  const items = listWishlist(c.id);
  const shopper = await getShopper();
  return (
    <>
      <p className="label">Your account</p>
      <h1 className="text-3xl">Saved items</h1>
      {items.length === 0 ? (
        <div className="box mt-6 p-6">
          <p className="font-semibold">Nothing saved yet.</p>
          <p className="mt-1 text-ink-soft">Tap the heart on any item to keep it here for later.</p>
          <Link href="/shops" className="btn btn-primary mt-4">Browse the shops</Link>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <li key={p.id}><ProductCard product={p} fx={shopper.fx} ctx={shopper.ctx} saved /></li>
          ))}
        </ul>
      )}
    </>
  );
}
