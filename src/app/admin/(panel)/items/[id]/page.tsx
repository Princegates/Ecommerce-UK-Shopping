import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash, PageHead } from "@/components/admin/ui";
import ProductForm from "@/components/admin/ProductForm";
import { allProductsAdmin, listShops } from "@/lib/catalog";

export default async function EditItem({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const product = allProductsAdmin().find((p) => p.id === Number(id));
  if (!product) notFound();
  return (
    <>
      <PageHead title={product.name}>
        <span className="flex gap-4">
          <Link href={`/products/${product.slug}`} className="link" target="_blank">View on site ↗</Link>
          <Link href="/admin/items" className="link">← All items</Link>
        </span>
      </PageHead>
      <Flash saved={sp.saved} error={sp.error} />
      <ProductForm product={product} shops={listShops({ includeInactive: true })} />
    </>
  );
}
