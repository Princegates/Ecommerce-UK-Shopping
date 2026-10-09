import Link from "next/link";
import { quoteRequestAction, saveLinkAutoAction, updateRequestAction } from "@/app/admin/actions";
import { Check, Flash, PageHead, Text, Area } from "@/components/admin/ui";
import { REQUEST_STATUSES } from "@/lib/admin";
import { appUrl } from "@/lib/app-url";
import { requirePermission } from "@/lib/auth";
import { getItemTypes, getLinkAuto, itemTypesToText } from "@/lib/link-auto";
import { hostOf, listAllLinkRequests, quoteState } from "@/lib/link-orders";
import { minorToInput } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function RequestsAdmin({ searchParams }: { searchParams: Promise<{ quoted?: string; via?: string; error?: string; saved?: string }> }) {
  await requirePermission("requests.manage");
  const sp = await searchParams;
  const requests = listAllLinkRequests();
  const base = appUrl() ?? "";
  const auto = getLinkAuto();
  const types = getItemTypes();
  return (
    <>
      <PageHead title="Link requests" />
      <p className="mb-6 max-w-2xl text-ink-soft">
        Customers send a link to a UK product. Check the price and stock on the shop, then <strong>send a quote</strong>: enter the UK price of one item and its weight.
        The customer gets a private link, sees the full cost in cedis, chooses delivery and pays. The paid order then appears under Orders and moves through the
        usual stages. Nothing is bought until the customer has paid.
      </p>
      <Flash saved={sp.saved} error={sp.error} />

      <details className="box box-shadow mb-6">
        <summary className="cursor-pointer p-4 text-xl font-bold">
          Automatic quotes: {auto.pageEnabled || auto.customerEnabled ? "on" : "off"}
          <span className="ml-2 text-sm font-normal text-ink-soft">
            {auto.pageEnabled ? "price read from the shop page" : ""}{auto.pageEnabled && auto.customerEnabled ? " + " : ""}{auto.customerEnabled ? `customer-typed price (+${auto.marginPct}%)` : ""}
          </span>
        </summary>
        <form action={saveLinkAutoAction} className="grid gap-5 border-t border-line p-5">
          <p className="text-sm text-ink-soft">
            The cost to the customer is always worked out from your own values: exchange rate, service charge, shipping rates and delivery fee. These settings decide
            whether the system may also fill in the UK price and the weight by itself, so the customer can pay at once. Anything outside the rules waits here for you to quote by hand.
          </p>
          <Check label="Quote by itself when the price is read from the shop's own web page (recommended)" name="pageEnabled" defaultChecked={auto.pageEnabled} />
          <Check label="Also quote by itself from the price the customer typed (it cannot be checked)" name="customerEnabled" defaultChecked={auto.customerEnabled} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Text label="Safety margin on customer-typed prices (%)" name="marginPct" inputMode="decimal" defaultValue={auto.marginPct} hint="Added on top of the price they typed." />
            <Text label="Automatic limit, UK price of one item (£)" name="ceiling" inputMode="decimal" defaultValue={minorToInput(auto.ceilingMinor)} hint="Dearer items wait for you." />
            <Text label="Hold each price for (days)" name="validDays" inputMode="numeric" defaultValue={auto.validDays} />
          </div>
          <Area
            label="Item types and their default weights (grams)"
            name="itemTypes"
            mono
            rows={Math.min(12, types.length + 2)}
            defaultValue={itemTypesToText(types)}
            hint="One per line, like “Shoes and boots: 1200”. Customers pick one on the request form and shipping is worked out from its weight. Keep a catch-all such as “Other or not sure” as the last line."
          />
          <div><button className="btn btn-primary">Save automatic-quote settings</button></div>
        </form>
      </details>
      {sp.quoted && (
        <p role="status" className="box mb-6 bg-gold/40 p-3 font-semibold">
          Quote saved for request #{sp.quoted}.{" "}
          {sp.via ? `The customer was messaged by ${sp.via}.` : "No message was sent (messaging may be switched off), so copy the quote link below and send it yourself."}
        </p>
      )}
      {!base && <p role="alert" className="box mb-6 border-red bg-red/10 p-3 text-sm font-semibold text-red">The site address (APP_URL) is not set to an https address, so customers cannot be messaged their pay link and links below are incomplete. Set APP_URL in your host&rsquo;s settings.</p>}
      {requests.length === 0 ? (
        <p>No requests yet.</p>
      ) : (
        <ul className="grid gap-5">
          {requests.map((r) => {
            const s = quoteState(r);
            const link = r.token ? `${base}/quote/${r.token}` : "";
            return (
              <li key={r.id} className={`box box-shadow grid gap-4 p-5 lg:grid-cols-[1.2fr_1fr] ${r.status === "NEW" ? "!bg-gold/25" : ""}`}>
                <div className="grid content-start gap-1">
                  <p className="label num">#{r.id} · {r.createdAt.slice(0, 16)} UTC{r.customerId ? " · signed-in customer" : " · guest"}</p>
                  <p className="text-lg font-semibold">{r.title || "Untitled item"} × {r.quantity}</p>
                  {r.url ? (
                    <p className="break-all"><a href={r.url} target="_blank" rel="noopener noreferrer" className="link">{hostOf(r.url)} ↗</a> <span className="text-xs text-ink-soft">{r.url}</span></p>
                  ) : (
                    <p className="text-sm">
                      <span className="tag mr-2">No link</span>The customer described the item.{" "}
                      <a href={`https://www.amazon.co.uk/s?k=${encodeURIComponent(r.title)}`} target="_blank" rel="noopener noreferrer nofollow" className="link">Search Amazon UK ↗</a>{" "}
                      <a href={`https://www.google.co.uk/search?q=${encodeURIComponent(r.title)}`} target="_blank" rel="noopener noreferrer nofollow" className="link">Search Google UK ↗</a>
                    </p>
                  )}
                  {r.details && <p>Details: {r.details}</p>}
                  {r.priceSeen && <p>Price they saw: £{r.priceSeen}</p>}
                  {r.itemType && <p className="text-sm text-ink-soft">Item type: {r.itemType}</p>}
                  <p className="mt-2">
                    <span className="font-semibold">{r.name}</span> · <a className="link" href={`tel:${r.phone}`}>{r.phone}</a>
                    {r.email && <> · {r.email}</>}
                  </p>
                  {r.quotePriceMinor !== null && (
                    <p className="mt-2 rounded-lg bg-paper-2 p-3 text-sm">
                      <span className="font-bold">Quoted £{minorToInput(r.quotePriceMinor)} each</span>{r.quoteSource === "page" && <span className="tag tag-green ml-2">auto: read from shop page</span>}{r.quoteSource === "customer" && <span className="tag ml-2">auto: customer price +margin</span>} · {r.quoteWeightGrams} g · {s === "expired" ? "expired" : s === "ordered" ? "ordered" : `held until ${r.quoteExpiresAt?.slice(0, 16)} UTC`}
                      {link && s !== "ordered" && (<><br /><span className="text-ink-soft">Customer&rsquo;s pay link (send it if they did not get the message):</span><br /><input readOnly value={link} className="input mt-1 !min-h-9 text-xs" aria-label="Customer pay link" /></>)}
                    </p>
                  )}
                  {r.orderId && <p className="mt-2 font-semibold"><Link href={`/admin/orders/${r.orderId}`} className="link">Open the order →</Link></p>}
                </div>

                <div className="grid content-start gap-4">
                  {!r.orderId && r.status !== "REJECTED" && (
                    <form action={quoteRequestAction} className="grid gap-3 rounded-lg border border-line p-3">
                      <input type="hidden" name="id" value={r.id} />
                      <p className="text-sm font-bold">{r.quotePriceMinor === null ? "Send a quote" : "Change the quote"}</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="field"><label className="label" htmlFor={`up${r.id}`}>UK price, each (£)</label><input id={`up${r.id}`} name="unitPrice" className="input" inputMode="decimal" defaultValue={r.quotePriceMinor !== null ? minorToInput(r.quotePriceMinor) : r.priceSeen} required /></div>
                        <div className="field"><label className="label" htmlFor={`w${r.id}`}>Weight, each (g)</label><input id={`w${r.id}`} name="weight" className="input" inputMode="numeric" defaultValue={r.quoteWeightGrams ?? 500} required /></div>
                        <div className="field"><label className="label" htmlFor={`v${r.id}`}>Valid (days)</label><input id={`v${r.id}`} name="validDays" className="input" inputMode="numeric" defaultValue={3} /></div>
                      </div>
                      {!r.url && <div className="field"><label className="label" htmlFor={`pu${r.id}`}>Link to the item you found (recommended)</label><input id={`pu${r.id}`} name="productUrl" className="input" placeholder="https://www.amazon.co.uk/…" /></div>}
                      <div className="field"><label className="label" htmlFor={`qn${r.id}`}>Note to the customer (optional)</label><input id={`qn${r.id}`} name="quoteNote" className="input" defaultValue={r.quoteNote} maxLength={300} placeholder="e.g. UK size 9 in black confirmed in stock" /></div>
                      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="notify" defaultChecked className="h-5 w-5 accent-[var(--green)]" /> Message the customer the pay link</label>
                      <button className="btn btn-primary w-fit">{r.quotePriceMinor === null ? "Send quote" : "Save and resend"}</button>
                    </form>
                  )}
                  <form action={updateRequestAction} className="grid gap-3">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="field">
                      <label className="label" htmlFor={`s${r.id}`}>Status</label>
                      <select id={`s${r.id}`} name="status" className="select" defaultValue={r.status}>
                        {REQUEST_STATUSES.map((st) => <option key={st} value={st}>{st.replace("_", " ").toLowerCase()}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor={`n${r.id}`}>Internal note</label>
                      <input id={`n${r.id}`} name="adminNote" className="input" defaultValue={r.adminNote} maxLength={500} />
                    </div>
                    <button className="btn btn-small w-fit">Save</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
