import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DepartmentIcon from "@/components/DepartmentIcon";
import ShopTile from "@/components/ShopTile";
import BrowseView from "@/components/shop/BrowseView";
import { departmentFromSlug, listShops } from "@/lib/catalog";
import { getShopper } from "@/lib/shopper";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = departmentFromSlug((await params).slug);
  return { title: d ? d.name : "Department not found" };
}

export default async function DepartmentPage({ params, searchParams }: Props) {
  const dept = departmentFromSlug((await params).slug);
  if (!dept) notFound();
  const sp = await searchParams;
  const shopper = await getShopper();
  const shops = listShops({ category: dept.name });
  return (
    <>
      <BrowseView
        basePath={`/department/${dept.slug}`}
        searchParams={sp}
        shopper={shopper}
        fixedDepartment={dept.name}
        heading={dept.name}
        intro={`${dept.products} items from ${dept.shops} UK ${dept.shops === 1 ? "shop" : "shops"}. Prices include the full cost to your door.`}
      />
      <section aria-labelledby="dshops-h" className="mx-auto max-w-7xl px-4 pb-4">
        <h2 id="dshops-h" className="flex items-center gap-3 text-3xl"><DepartmentIcon name={dept.name} className="h-9 w-9 text-green" />Shops in {dept.name}</h2>
        <ul className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shops.map((s) => <li key={s.id}><ShopTile shop={s} /></li>)}
        </ul>
      </section>
    </>
  );
}
