import { logoutAction } from "@/app/actions/account";
import AccountNav from "@/components/account/AccountNav";
import { requireCustomer } from "@/lib/customer-session";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const c = await requireCustomer("/account");
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-[14rem_1fr]">
      <aside className="md:sticky md:top-44 md:self-start">
        <p className="label">Signed in as</p>
        <p className="display text-2xl">{c.name}</p>
        <p className="mb-4 text-sm text-ink-soft">{c.email ?? c.phone}</p>
        <AccountNav />
        <form action={logoutAction} className="mt-4 hidden md:block">
          <button className="btn btn-small w-full">Sign out</button>
        </form>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
