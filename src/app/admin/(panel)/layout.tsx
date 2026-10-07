import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import MobileNav from "@/components/admin/MobileNav";
import { requireAdmin, can } from "@/lib/auth";
import { newRequestCount } from "@/lib/admin";
import { reviewCount } from "@/lib/ingest/store";
import { ROLE_LABEL, type Permission } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** `need` is the right a person must hold to see the link; "super" means only the super admin. */
const NAV: { heading: string; items: { href: string; label: string; need: Permission | "super" }[] }[] = [
  { heading: "Overview", items: [{ href: "/admin", label: "Dashboard", need: "dashboard.view" }] },
  {
    heading: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", need: "orders.view" },
      { href: "/admin/customers", label: "Customers", need: "customers.view" },
      { href: "/admin/requests", label: "Link requests", need: "requests.manage" },
    ],
  },
  {
    heading: "Catalogue",
    items: [
      { href: "/admin/shops", label: "Shops", need: "shops.manage" },
      { href: "/admin/items", label: "Items", need: "items.manage" },
      { href: "/admin/sources", label: "Catalogue sources", need: "sources.manage" },
      { href: "/admin/import", label: "Import review", need: "import.review" },
      { href: "/admin/reviews", label: "Reviews", need: "reviews.manage" },
    ],
  },
  {
    heading: "Pricing and delivery",
    items: [
      { href: "/admin/pricing", label: "Pricing", need: "pricing.manage" },
      { href: "/admin/shipping", label: "Shipping", need: "pricing.manage" },
      { href: "/admin/zones", label: "Delivery areas", need: "pricing.manage" },
    ],
  },
  {
    heading: "System",
    items: [
      { href: "/admin/appearance", label: "Appearance", need: "appearance.manage" },
      { href: "/admin/integrations", label: "Integrations", need: "integrations.manage" },
      { href: "/admin/messages", label: "Messages", need: "messages.view" },
      { href: "/admin/audit", label: "Activity log", need: "audit.view" },
      { href: "/admin/users", label: "Staff accounts", need: "super" },
    ],
  },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // pages and actions check their own rights; this only needs to know who is signed in (a first-time password change comes first)
  const who = await requireAdmin({ allowPasswordChange: true });
  const { siteName } = getSettings();
  const locked = Boolean(who.user?.mustChangePassword);
  const allowed = (need: Permission | "super") => !locked && (need === "super" ? who.isSuper : can(who, need));
  const pending = !locked && can(who, "requests.manage") ? newRequestCount() : 0;
  const toReview = !locked && can(who, "import.review") ? reviewCount() : 0;
  const groups = NAV.map((g) => ({
    heading: g.heading,
    items: g.items.filter((i) => allowed(i.need)).map((i) => ({ href: i.href, label: i.label, badge: i.href === "/admin/requests" ? pending : i.href === "/admin/import" ? toReview : 0 })),
  })).filter((g) => g.items.length > 0);
  groups.push({ heading: "You", items: [{ href: "/admin/account", label: "My account", badge: 0 }] });
  const role = who.isSuper ? "Super admin" : who.user ? ROLE_LABEL[who.user.role] : "";

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] md:grid-cols-[14rem_minmax(0,1fr)] md:grid-rows-1">
      <aside className="min-w-0 bg-ink text-paper max-md:sticky max-md:top-0 max-md:z-40 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <MobileNav
          siteName={siteName}
          groups={groups}
          who={`${who.name} · ${role}`}
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
            <p className="text-sm"><span className="font-semibold">{who.name}</span><span className="label block !text-paper/60">{role}</span></p>
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
