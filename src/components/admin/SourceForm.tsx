"use client";

import { useActionState, useState } from "react";
import { previewSourceAction, saveSourceAction, type PreviewState } from "@/app/admin/ingest-actions";
import { Area, Check, Select, Text } from "@/components/admin/ui";
import { gbp } from "@/lib/money";

export type SourceFormValues = {
  id: number;
  shopId: number;
  name: string;
  kind: string;
  urlDisplay: string;
  fieldMapText: string;
  termsUrl: string;
  termsNote: string;
  termsConfirmedAt: string | null;
  enabled: boolean;
  autoPublishNew: boolean;
  autoApplyUpdates: boolean;
  maxPriceChangePct: number;
  maxItems: number;
  delaySeconds: number;
  intervalHours: number;
  staleDays: number;
  defaultCategory: string;
  defaultWeightGrams: number;
};

export default function SourceForm({
  v, shops, kinds,
}: {
  v: SourceFormValues;
  shops: { id: number; name: string }[];
  kinds: { kind: string; label: string; help: string }[];
}) {
  const [pv, previewAct, previewing] = useActionState<PreviewState, FormData>(previewSourceAction, {});
  const editing = v.id > 0;
  const [kind, setKind] = useState(v.kind);
  const isEbay = kind === "ebay";
  const isShopify = kind === "shopify" || kind === "woocommerce";
  const isUpload = kind === "upload";

  return (
    <form action={saveSourceAction} className="grid gap-8">
      <input type="hidden" name="id" value={v.id} />

      <section className="box box-shadow grid gap-4 p-5">
        <h2 className="text-2xl">Where the products come from</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Shop these items belong to" name="shopId" defaultValue={v.shopId}>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Text label="Name for this source" name="name" defaultValue={v.name} required placeholder="e.g. Northgate affiliate feed" />
        </div>
        <div className="field">
          <label className="label" htmlFor="kind">Type</label>
          <select id="kind" name="kind" className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
          </select>
          <p className="hint">{kinds.find((k) => k.kind === kind)?.help}</p>
        </div>
        {isEbay ? (
          <>
            <input type="hidden" name="url" value="" />
            <Area
              label="Your eBay searches (one per line, up to 10)"
              name="fieldMap"
              defaultValue={v.fieldMapText}
              mono
              rows={5}
              hint="For example: men's trainers, kettle, baby clothes. Each search brings in up to 'Items per search' new UK listings priced in pounds, with eBay's photos. Add your free eBay keys first under Integrations."
            />
          </>
        ) : (
          <>
            {isUpload && <input type="hidden" name="url" value="" />}
            {isShopify && <input type="hidden" name="fieldMap" value="" />}
            {!isUpload && (
              <Text
                label={isShopify ? (editing ? "Shop address (leave empty to keep the saved one)" : "Shop address, for example https://shop.example.co.uk") : editing ? "Feed or sitemap address (leave empty to keep the saved one)" : "Feed or sitemap address"}
                name="url"
                type="url"
                placeholder="https://"
                hint={editing && v.urlDisplay ? `Saved address: ${v.urlDisplay}. Addresses are stored encrypted because feed links often contain a key.` : "Stored encrypted because feed links often contain a key. Not needed for pasted links."}
              />
            )}
            {isShopify ? (
              <p className="hint">Nothing else to set up. Products whose sizes or colours cost different amounts are skipped, because the site holds one price per product. Click &ldquo;Check this setup first&rdquo; to see what would be read.</p>
            ) : (
              <Area
                label="Column names (optional)"
                name="fieldMap"
                defaultValue={v.fieldMapText}
                mono
                rows={4}
                hint="One per line, like name=product_title. Most feeds are recognised automatically. For JSON use paths like price=offer.gbp. For website sources, include=/product/ limits which pages are read."
              />
            )}
          </>
        )}
      </section>

      <section className="box box-shadow grid gap-4 border-gold p-5">
        <h2 className="text-2xl">Permission</h2>
        <p className="text-ink-soft">
          Only read data you are allowed to. An official or affiliate feed is the safe route. For a shop&rsquo;s website, check its terms and
          robots.txt first. The importer obeys robots.txt and stops when a shop refuses access. It never tries to get around a block, a
          CAPTCHA or an IP ban.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Text label="Link to the terms or licence (optional)" name="termsUrl" type="url" defaultValue={v.termsUrl} placeholder="https://" />
          <Text label="Note for your records (optional)" name="termsNote" defaultValue={v.termsNote} placeholder="e.g. Awin programme approved 12 Oct" />
        </div>
        {v.termsConfirmedAt ? (
          <p className="font-semibold">Terms confirmed on {v.termsConfirmedAt.slice(0, 10)}.</p>
        ) : (
          <Check label="I have checked that this shop's terms allow us to read this data, or that we hold a licence for this feed." name="confirmTerms" />
        )}
      </section>

      <section className="box box-shadow grid gap-4 p-5">
        <h2 className="text-2xl">What happens to what we read</h2>
        <Check label={isUpload ? "Switch this source on (items stay visible while it is on)" : "Switch this source on (it then runs by itself on the schedule below)"} name="enabled" defaultChecked={v.enabled} />
        <Check label="Publish new items automatically" name="autoPublishNew" defaultChecked={v.autoPublishNew} />
        <Check label="Update prices, was-prices and stock on live items automatically" name="autoApplyUpdates" defaultChecked={v.autoApplyUpdates} />
        <div className="grid gap-4 md:grid-cols-3">
          <Text label="Hold a price move bigger than (%)" name="maxPriceChangePct" inputMode="numeric" defaultValue={v.maxPriceChangePct} hint="Bigger jumps wait for you in Import review." />
          <Text label="Run every (hours)" name="intervalHours" inputMode="numeric" defaultValue={v.intervalHours} />
          <Text label="Hide items not refreshed for (days)" name="staleDays" inputMode="numeric" defaultValue={v.staleDays} hint={isUpload ? "Up to 90. Upload a fresh file before then, or the items are hidden so an old price never stays on sale." : "So an old price never stays on sale."} />
        </div>
        <details>
          <summary className="cursor-pointer font-semibold">More settings</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Text label={isEbay ? "Items per search" : isShopify ? "Products read per run (up to 500)" : "Pages read per run (website and link sources)"} name="maxItems" inputMode="numeric" defaultValue={v.maxItems} hint={isEbay ? "Up to 200. eBay returns its best matches for each search." : isShopify ? kind === "woocommerce" ? "The product list is read 100 at a time, slowly." : "The product list is read 250 at a time, slowly." : "Pages are read slowly, so a big shop is covered over several runs."} />
            <Text label="Seconds between page requests (at least 2)" name="delaySeconds" inputMode="decimal" defaultValue={v.delaySeconds} hint="A longer Crawl-delay in the shop's robots.txt always wins." />
            <Text label="Category for items that have none" name="defaultCategory" defaultValue={v.defaultCategory} />
            <Text label="Weight when the shop gives none (grams)" name="defaultWeightGrams" inputMode="numeric" defaultValue={v.defaultWeightGrams} hint="Used for shipping. Check heavy categories." />
          </div>
        </details>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary">{editing ? "Save source" : "Create source"}</button>
        <button type="submit" formAction={previewAct} disabled={previewing} className="btn">
          {previewing ? "Checking…" : "Check this setup first"}
        </button>
        <span className="hint">The check reads a few items and saves nothing.</span>
      </div>

      <div aria-live="polite">
        {pv.error && <p role="alert" className="error-text">{pv.error}</p>}
        {pv.preview && (
          <section className="box p-5">
            <p className={`font-bold ${pv.preview.ok ? "text-green" : "text-red"}`}>{pv.preview.message}</p>
            {pv.preview.skipNote && <p className="mt-1 text-sm text-ink-soft">{pv.preview.skipNote}</p>}
            {pv.preview.sample.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Item</th><th className="text-right">Price</th><th className="text-right">Was</th><th>Stock</th><th>Image</th></tr></thead>
                  <tbody>
                    {pv.preview.sample.map((s) => (
                      <tr key={s.externalId}>
                        <td className="font-semibold">{s.name}<span className="block text-xs text-ink-soft">{s.brand}{s.category ? ` · ${s.category}` : ""}</span></td>
                        <td className="num text-right">{gbp(s.priceMinor)}</td>
                        <td className="num text-right">{s.compareAtMinor ? gbp(s.compareAtMinor) : ""}</td>
                        <td>{s.inStock ? "In stock" : "Out"}</td>
                        <td>{s.imageUrl ? "Yes" : "None"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </form>
  );
}
