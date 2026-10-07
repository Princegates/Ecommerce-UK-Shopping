import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { PageHead } from "@/components/admin/ui";
import { allProductsAdmin } from "@/lib/catalog";
import { gbp } from "@/lib/money";

export default async function ItemsAdmin() {
  await requireAdmin();
  const items = allProductsAdmin();
  return (
    <>
      <PageHead title="Items">
        <Link href="/admin/items/new" className="btn btn-primary">Add an item</Link>
      </PageHead>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Item</th><th>Shop</th><th>Category</th><th className="text-right">UK price</th><th className="text-right">Weight</th><th>Shown</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td><Link className="link font-semibold" href={`/admin/items/${p.id}`}>{p.name}</Link></td>
                <td>{p.shopName}</td>
                <td>{p.category}</td>
                <td className="num text-right">{gbp(p.priceMinor)}</td>
                <td className="num text-right">{p.weightGrams} g</td>
                <td>{p.active ? "Yes" : <span className="tag">Hidden</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
