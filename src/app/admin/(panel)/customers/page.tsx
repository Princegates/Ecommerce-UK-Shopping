import Link from "next/link";
import { PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { listCustomers } from "@/lib/customers";
import { ghs } from "@/lib/money";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const customers = listCustomers(q);
  return (
    <>
      <PageHead title="Customers" />
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <div className="field">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="Name, phone or email" />
        </div>
        <button className="btn">Search</button>
      </form>
      {customers.length === 0 ? (
        <p>No customers {q ? "match" : "yet"}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-cards">
            <thead><tr><th>Customer</th><th>Contact</th><th className="text-right">Orders</th><th className="text-right">Spent</th><th>Joined</th><th>Last sign-in</th><th>Status</th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td data-label=""><Link className="link font-semibold" href={`/admin/customers/${c.id}`}>{c.name}</Link></td>
                  <td data-label="Contact">{c.phone}{c.email && <span className="label block normal-case">{c.email}</span>}</td>
                  <td data-label="Orders" className="num text-right">{c.orderCount}</td>
                  <td data-label="Spent" className="num text-right">{ghs(c.spentMinor)}</td>
                  <td data-label="Joined" className="num whitespace-nowrap">{c.createdAt.slice(0, 10)}</td>
                  <td data-label="Last sign-in" className="num whitespace-nowrap">{c.lastLoginAt?.slice(0, 10) ?? "never"}</td>
                  <td data-label="Status">{c.status === "ACTIVE" ? "Active" : <span className="tag tag-red">Disabled</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
