import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import MobileNav from "@/components/admin/MobileNav";
import { requireAdmin } from "@/lib/auth";
import { newRequestCount } from "@/lib/admin";
import { reviewCount } from "@/lib/ingest/store";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const NAV: { heading: string; items: [string, string][] }[] = [
  { heading: "Overview", items: [["/admin", "Dashboard"]] },
  { heading: "Sales", items: [["/admin/orders", "Orders"], ["/admin/customers", "Customers"], ["/admin/requests", "Link requests"]] },
  { heading: "Catalogue", items: [["/admin/shops", "Shops"], ["/admin/items", "Items"], ["/admin/sources", "Catalogue sources"], ["/admin/import", "Import review"], ["/admin/reviews", "Reviews"]] },
  { heading: "Pricing and delivery", items: [["/admin/pricing", "Pricing"], ["/admin/shipping", "Shipping"], ["/admin/zones", "Delivery areas"]] },
  { heading: "System", items: [["/admin/appearance", "Appearance"], ["/admin/integrations", "Integrations"], ["/admin/messages", "Messages"], ["/admin/audit", "Activity log"]] },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const { siteName } = getSettings();
  const pending = newRequestCount();
  const toReview = reviewCount();
  const groups = NAV.map((g) => ({
    heading: g.heading,
    items: g.items.map(([href, label]) => ({ href, label, badge: href === "/admin/requests" ? pending : href === "/admin/import" ? toReview : 0 })),
  }));
  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] md:grid-cols-[14rem_minmax(0,1fr)] md:grid-rows-1">
      <aside className="min-w-0 bg-ink text-paper max-md:sticky max-md:top-0 max-md:z-40 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <MobileNav
          siteName={siteName}
          groups={groups}
          signOut={<form action={logoutAction}><button className="btn btn-small min-h-11 w-full">Sign out</button></form>}
        />
        <div className="hidden md:block">
          <div className="p-4">
            <p className="display text-2xl">{siteName}</p>
            <p className="label !text-gold">Admin</p>
          </div>
          <nav aria-label="Admin" className="grid gap-3 px-2 pb-3">
            {groups.map((g) => (
              <div key={g.heading} className="grid">
                <p className="label !text-paper/50 px-3">{g.heading}</p>
                {g.items.map((i) => (
                  <Link key={i.href} href={i.href} className="whitespace-nowrap px-3 py-2 font-semibold hover:bg-gold hover:text-ink">
                    {i.label}
                    {i.badge ? <span className="tag tag-gold ml-2">{i.badge}</span> : null}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="grid gap-2 p-4">
            <Link href="/" className="text-sm font-semibold text-gold hover:underline">View the site ↗</Link>
            <form action={logoutAction}>
              <button className="btn btn-small w-full">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0 p-4 md:p-8 [&_.grid>*]:min-w-0 max-md:[&_table]:block max-md:[&_table]:max-w-full max-md:[&_table]:overflow-x-auto">{children}</div>
    </div>
  );
}
