import { requireAdmin } from "@/lib/auth";
import { updateRequestAction } from "@/app/admin/actions";
import { PageHead } from "@/components/admin/ui";
import { REQUEST_STATUSES, listLinkRequests } from "@/lib/admin";

export default async function RequestsAdmin() {
  await requireAdmin();
  const requests = listLinkRequests();
  return (
    <>
      <PageHead title="Link requests" />
      <p className="mb-6 max-w-2xl text-ink-soft">
        Customers send a link to a UK product. Check the price and stock on the shop, contact the customer with the full
        cost, and record where it stands. Nothing is bought until the customer has paid.
      </p>
      {requests.length === 0 ? (
        <p>No requests yet.</p>
      ) : (
        <ul className="grid gap-5">
          {requests.map((r) => (
            <li key={r.id} className={`box box-shadow grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr] ${r.status === "NEW" ? "!bg-gold/25" : ""}`}>
              <div className="grid content-start gap-1">
                <p className="label num">#{r.id} · {r.createdAt.slice(0, 16)} UTC</p>
                <p className="text-lg font-semibold">{r.title || "Untitled item"} × {r.quantity}</p>
                <p className="break-all"><a href={r.url} target="_blank" rel="noopener noreferrer" className="link">{r.url} ↗</a></p>
                {r.details && <p>Details: {r.details}</p>}
                {r.priceSeen && <p>Price they saw: £{r.priceSeen}</p>}
                <p className="mt-2">
                  <span className="font-semibold">{r.name}</span> · <a className="link" href={`tel:${r.phone}`}>{r.phone}</a>
                  {r.email && <> · {r.email}</>}
                </p>
              </div>
              <form action={updateRequestAction} className="grid content-start gap-3">
                <input type="hidden" name="id" value={r.id} />
                <div className="field">
                  <label className="label" htmlFor={`s${r.id}`}>Status</label>
                  <select id={`s${r.id}`} name="status" className="select" defaultValue={r.status}>
                    {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor={`n${r.id}`}>Internal note</label>
                  <input id={`n${r.id}`} name="adminNote" className="input" defaultValue={r.adminNote} maxLength={500} />
                </div>
                <button className="btn btn-small w-fit">Save</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
