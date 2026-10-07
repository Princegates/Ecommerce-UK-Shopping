import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { PageHead } from "@/components/admin/ui";
import ProductArt from "@/components/ProductArt";
import { allProductsAdmin } from "@/lib/catalog";
import { gbp } from "@/lib/money";

export default async function ItemsAdmin() {
  await requireAdmin();
  const items = allProductsAdmin();
  return (
    <>
      <PageHead title="Items">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/sources#links-h" className="btn btn-gold">＋ Add by link</Link>
          <Link href="/admin/items/new" className="btn btn-primary">Add an item</Link>
        </div>
      </PageHead>
      <div className="overflow-x-auto">
        <table className="table table-cards">
          <thead><tr><th>Photo</th><th>Item</th><th>Shop</th><th>Category</th><th className="text-right">UK price</th><th className="text-right">Weight</th><th>Shown</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td data-label="" className="w-16"><div className="h-12 w-12 overflow-hidden rounded-lg border border-line"><ProductArt name={p.name} accent={p.shopAccent} imageUrl={p.imageUrl} category={p.category} /></div></td>
                <td data-label=""><Link className="link font-semibold" href={`/admin/items/${p.id}`}>{p.name}</Link></td>
                <td data-label="Shop">{p.shopName}</td>
                <td data-label="Category">{p.category}</td>
                <td data-label="UK price" className="num text-right">{gbp(p.priceMinor)}</td>
                <td data-label="Weight" className="num text-right">{p.weightGrams} g</td>
                <td data-label="Shown">{p.active ? "Yes" : <span className="tag">Hidden</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
