import { requirePermission } from "@/lib/auth";
import { deleteShopAction, saveShopAction } from "@/app/admin/actions";
import { Area, Check, Flash, PageHead, Text } from "@/components/admin/ui";
import ShopLogo from "@/components/ShopLogo";
import { listShops, type Shop } from "@/lib/catalog";

function ShopForm({ s }: { s?: Shop }) {
  const k = `shop-${s?.id ?? "new"}`;
  return (
    <form action={saveShopAction} className="grid gap-4">
      <input type="hidden" name="id" value={s?.id ?? 0} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Shop name" name="name" id={`${k}-name`} defaultValue={s?.name} required />
        <Text label="Category" name="category" id={`${k}-category`} defaultValue={s?.category} required placeholder="Fashion" />
      </div>
      <Text label="One-line tagline" name="tagline" id={`${k}-tagline`} defaultValue={s?.tagline} />
      <Area label="Description" name="description" id={`${k}-description`} defaultValue={s?.description} rows={3} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Text label="Shop website (optional)" name="websiteUrl" id={`${k}-websiteUrl`} defaultValue={s?.websiteUrl} placeholder="https://" className="sm:col-span-2" />
        <Text label="Colour" name="accent" id={`${k}-accent`} defaultValue={s?.accent ?? "#0b5d3b"} hint="Hex, like #0b5d3b" />
      </div>
      <fieldset className="grid gap-3 border border-line p-4">
        <legend className="label px-2 text-ink">Logo</legend>
        <div className="flex flex-wrap items-center gap-4">
          <ShopLogo shop={{ name: s?.name || "?", accent: s?.accent ?? "#0b5d3b", logoUrl: s?.logoUrl ?? "" }} className="h-16 w-16 text-2xl" />
          <div className="grid min-w-0 flex-1 gap-3">
            <div className="field">
              <label className="label" htmlFor={`${k}-logoFile`}>Upload a logo</label>
              <input id={`${k}-logoFile`} name="logoFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="input !p-1.5" />
              <p className="hint">JPEG, PNG, WebP or GIF, up to 4 MB. A square logo on a plain or transparent background looks best. Only upload logos you have the right to use.</p>
            </div>
            <Text label="Or paste a logo link" name="logoUrl" id={`${k}-logoUrl`} defaultValue={s?.logoUrl ?? ""} placeholder="https://" />
            {s?.logoUrl && <Check label="Remove the current logo" name="removeLogo" />}
          </div>
        </div>
      </fieldset>
      <Text label="Order on the page" name="sort" id={`${k}-sort`} inputMode="numeric" defaultValue={s ? 0 : 20} hint="Lower shows first." />
      <Check label="Show this shop to customers" name="active" defaultChecked={s?.active ?? true} />
      <div><button className="btn btn-primary">{s ? "Save shop" : "Add shop"}</button></div>
    </form>
  );
}

export default async function ShopsAdmin({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requirePermission("shops.manage");
  const sp = await searchParams;
  const shops = listShops({ includeInactive: true });
  return (
    <>
      <PageHead title="Shops" />
      <p className="mb-6 max-w-2xl text-ink-soft">
        Only list a shop after checking its terms allow purchases made on a customer&rsquo;s behalf, and only use logos
        and photos you are licensed to show.
      </p>
      <Flash saved={sp.saved} error={sp.error} />
      <div className="grid gap-6">
        {shops.map((s) => (
          <details key={s.id} className="box box-shadow">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4 text-xl font-bold">
              <span className="flex items-center gap-3">
                <ShopLogo shop={s} className="h-9 w-9 text-sm" />
                {s.name} {!s.active && <span className="tag">Hidden</span>}
              </span>
              <span className="label">{s.productCount} items</span>
            </summary>
            <div className="border-t border-line p-5 grid gap-6">
              <ShopForm s={s} />
              <form action={deleteShopAction} className="grid gap-3 border-t border-line pt-5">
                <input type="hidden" name="id" value={s.id} />
                <h3 className="text-lg font-bold">Delete this shop</h3>
                <p className="text-sm text-ink-soft">
                  Removes <strong>{s.name}</strong>, its {s.productCount} item{s.productCount === 1 ? "" : "s"} and any catalogue sources set up for it. Items
                  leave customers&rsquo; baskets and wishlists. Orders already placed keep their own record. This cannot be undone. To keep the shop but stop
                  showing it, untick &ldquo;Show this shop to customers&rdquo; above instead.
                </p>
                <Check label={`Yes, delete ${s.name} and everything in it`} name="confirm" />
                <div><button className="btn btn-danger">Delete shop</button></div>
              </form>
            </div>
          </details>
        ))}
        <details className="box box-shadow">
          <summary className="cursor-pointer p-4 text-xl font-bold">+ Add a shop</summary>
          <div className="border-t border-line p-5"><ShopForm /></div>
        </details>
      </div>
    </>
  );
}
