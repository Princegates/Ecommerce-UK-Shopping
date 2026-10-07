import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { Flash, PageHead } from "@/components/admin/ui";
import ProductForm from "@/components/admin/ProductForm";
import { listShops } from "@/lib/catalog";

export default async function NewItem({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePermission("items.manage");
  const sp = await searchParams;
  return (
    <>
      <PageHead title="Add an item">
        <Link href="/admin/items" className="link">← All items</Link>
      </PageHead>
      <Flash error={sp.error} />
      <ProductForm shops={listShops({ includeInactive: true })} />
    </>
  );
}
