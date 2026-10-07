import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { newRequestCount } from "@/lib/admin";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const NAV: { heading: string; items: [string, string][] }[] = [
  { heading: "Overview", items: [["/admin", "Dashboard"]] },
  { heading: "Sales", items: [["/admin/orders", "Orders"], ["/admin/customers", "Customers"], ["/admin/requests", "Link requests"]] },
  { heading: "Catalogue", items: [["/admin/shops", "Shops"], ["/admin/items", "Items"], ["/admin/reviews", "Reviews"]] },
  { heading: "Pricing and delivery", items: [["/admin/pricing", "Pricing"], ["/admin/shipping", "Shipping"], ["/admin/zones", "Delivery areas"]] },
  { heading: "System", items: [["/admin/integrations", "Integrations"], ["/admin/messages", "Messages"], ["/admin/audit", "Activity log"]] },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const { siteName } = getSettings();
  const pending = newRequestCount();
  return (
    <div className="grid min-h-screen md:grid-cols-[14rem_1fr]">
      <aside className="bg-ink text-paper md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <div className="flex items-center justify-between gap-2 p-4 md:block">
          <p className="display text-2xl">{siteName}</p>
          <p className="label !text-gold">Admin</p>
        </div>
        <nav aria-label="Admin" className="flex gap-4 overflow-x-auto px-2 pb-3 md:grid md:gap-3 md:overflow-visible">
          {NAV.map((g) => (
            <div key={g.heading} className="flex shrink-0 gap-1 md:grid">
              <p className="label hidden !text-paper/50 md:block md:px-3">{g.heading}</p>
              {g.items.map(([href, label]) => (
                <Link key={href} href={href} className="whitespace-nowrap px-3 py-2 font-semibold hover:bg-gold hover:text-ink">
                  {label}
                  {href === "/admin/requests" && pending > 0 && <span className="tag tag-gold ml-2">{pending}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="hidden gap-2 p-4 md:grid">
          <Link href="/" className="link text-sm">View the site ↗</Link>
          <form action={logoutAction}>
            <button className="btn btn-small w-full">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 p-4 md:p-8">{children}</div>
    </div>
  );
}
