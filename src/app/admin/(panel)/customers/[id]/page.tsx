import Link from "next/link";
import { notFound } from "next/navigation";
import { setCustomerStatusAction } from "@/app/admin/ops-actions";
import { Flash, PageHead } from "@/components/admin/ui";
import ResetLinkForm from "@/components/admin/ResetLinkForm";
import StatusChip from "@/components/StatusChip";
import { can, requirePermission } from "@/lib/auth";
import { getCustomerById, listAddresses, sessionCount } from "@/lib/customers";
import { ghs } from "@/lib/money";
import { listOrdersForCustomer } from "@/lib/orders";

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const who = await requirePermission("customers.view");
  const canManage = can(who, "customers.manage");
  const { id } = await params;
  const sp = await searchParams;
  const c = getCustomerById(Number(id));
  if (!c) notFound();
  const orders = listOrdersForCustomer(c.id);
  const addresses = listAddresses(c.id);
  const spent = orders.filter((o) => o.paymentStatus === "PAID").reduce((n, o) => n + o.totalMinor, 0);

  return (
    <>
      <PageHead title={c.name}>
        <Link href="/admin/customers" className="link">← All customers</Link>
      </PageHead>
      <Flash saved={sp.saved} error={sp.error} />
      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-8">
          <section>
            <h2 className="text-2xl">Orders</h2>
            {orders.length === 0 ? (
              <p className="mt-3">No orders yet.</p>
            ) : (
              <table className="table mt-3">
                <thead><tr><th>Order</th><th>Placed</th><th>Status</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td><Link className="link mono" href={`/admin/orders/${o.id}`}>{o.number}</Link></td>
                      <td className="num">{o.createdAt.slice(0, 10)}</td>
                      <td><StatusChip status={o.status} /></td>
                      <td className="num text-right">{ghs(o.totalMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section>
            <h2 className="text-2xl">Saved addresses</h2>
            {addresses.length === 0 ? <p className="mt-3">None.</p> : (
              <ul className="mt-3 grid gap-2">
                {addresses.map((a) => (
                  <li key={a.id} className="box p-3 text-sm">
                    <span className="font-semibold">{a.label}{a.isDefault ? " (default)" : ""}</span>: {a.recipient}, {a.address}{a.landmark ? `, ${a.landmark}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid content-start gap-8">
          <section className="box p-5">
            <h2 className="text-xl">Details</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div><dt className="label">Phone</dt><dd><a className="link" href={`tel:${c.phone}`}>{c.phone}</a></dd></div>
              <div><dt className="label">Email</dt><dd>{c.email ?? "Not given"}</dd></div>
              <div><dt className="label">Member since</dt><dd className="num">{c.createdAt.slice(0, 10)}</dd></div>
              <div><dt className="label">Last sign-in</dt><dd className="num">{c.lastLoginAt ?? "Never"}</dd></div>
              <div><dt className="label">Signed in on</dt><dd>{sessionCount(c.id)} device(s)</dd></div>
              <div><dt className="label">Updates by</dt><dd>{[c.notifySms && "SMS", c.notifyEmail && "email", c.notifyWhatsapp && "WhatsApp"].filter(Boolean).join(", ") || "Nothing"}</dd></div>
              <div><dt className="label">Total paid</dt><dd className="num font-semibold">{ghs(spent)}</dd></div>
            </dl>
          </section>
          {canManage && (
          <>
          <section className="box p-5">
            <h2 className="text-xl">Help with sign-in</h2>
            <p className="mb-3 mt-1 text-sm text-ink-soft">If they cannot receive the automatic reset message, create a link and send it to them yourself.</p>
            <ResetLinkForm id={c.id} />
          </section>
          <section className="box p-5">
            <h2 className="text-xl">Account status</h2>
            <p className="mb-3 mt-1 text-sm text-ink-soft">Disabling signs the customer out everywhere and stops them signing in. Their orders are not affected.</p>
            <form action={setCustomerStatusAction}>
              <input type="hidden" name="id" value={c.id} />
              {c.status === "ACTIVE"
                ? <button name="status" value="DISABLED" className="btn btn-danger btn-small">Disable this account</button>
                : <button name="status" value="ACTIVE" className="btn btn-primary btn-small">Enable this account</button>}
            </form>
          </section>
          </>
          )}
        </div>
      </div>
    </>
  );
}
