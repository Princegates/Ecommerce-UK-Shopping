import { saveProductAction } from "@/app/admin/actions";
import { Area, Check, Select, Text } from "@/components/admin/ui";
import { optionGroupsToText } from "@/lib/admin-parse";
import type { Product, Shop } from "@/lib/catalog";
import { inferDutyCategory } from "@/lib/duty-category";
import { minorToInput } from "@/lib/money";
import type { PricingConfig } from "@/lib/quote-engine";

export default function ProductForm({ product, shops, categories }: { product?: Product; shops: Shop[]; categories: PricingConfig["categories"] }) {
  // the catalogue fills in the guessed category, so only show a choice when it differs from the guess
  const dutyChoice = product && product.dutyCategory !== inferDutyCategory(product.name, product.category) ? product.dutyCategory : "";
  return (
    <form action={saveProductAction} className="grid max-w-3xl gap-5">
      <input type="hidden" name="id" value={product?.id ?? 0} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Shop" name="shopId" defaultValue={product?.shopId}>
          {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Text label="Category" name="category" defaultValue={product?.category} placeholder="Trainers" />
      </div>
      <Text label="Item name" name="name" defaultValue={product?.name} required />
      <div className="grid gap-4 sm:grid-cols-3">
        <Text label="Brand" name="brand" defaultValue={product?.brand} />
        <Text label="UK shop price (£)" name="price" inputMode="decimal" defaultValue={product ? minorToInput(product.priceMinor) : ""} required hint="The price on the UK shop, with no markup." />
        <Text label="Weight (grams)" name="weightGrams" inputMode="numeric" defaultValue={product?.weightGrams ?? 500} required hint="Packed weight. Drives shipping." />
      </div>
      <Select label="Import duty category" name="dutyCategory" defaultValue={dutyChoice} hint="Sets the import duty in the price. Leave on Automatic to work it out from the name and category. Items we cannot place are priced at the highest rate and flagged for you to check.">
        <option value="">Automatic (from the name)</option>
        {categories.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
      </Select>
      <Area label="Description" name="description" defaultValue={product?.description} rows={4} />
      <Area
        label="Options customers choose"
        name="options"
        mono
        rows={3}
        defaultValue={product ? optionGroupsToText(product.options) : ""}
        hint="One per line, like “Size: UK 7, UK 8, UK 9” or “Colour: Black, White”. Leave empty if there are none."
      />
      <fieldset className="box grid gap-4 p-4">
        <legend className="label px-2 text-ink">Photo</legend>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-xl border border-line bg-paper-2 text-center text-xs text-ink-soft">
            {product?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt="Current photo" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
            ) : "No photo yet"}
          </div>
          <div className="grid content-start gap-3">
            <div className="field">
              <label className="label" htmlFor="imageFile">Upload a photo</label>
              <input id="imageFile" name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="input !p-1.5" />
              <p className="hint">JPEG, PNG, WebP or GIF, up to 4 MB. A square photo on a white background looks best. Only upload photos you have the right to use.</p>
            </div>
            <Text label="Or paste a photo link (only if you are licensed to use it)" name="imageUrl" defaultValue={product?.imageUrl ?? ""} placeholder="https://" />
            {product?.imageUrl && <Check label="Remove the current photo" name="removeImage" />}
          </div>
        </div>
      </fieldset>
      <Text label="Link to the item on the shop's website" name="sourceUrl" defaultValue={product?.sourceUrl} placeholder="https://" />
      <Check label="Show this item to customers" name="active" defaultChecked={product?.active ?? true} />
      <div><button className="btn btn-primary">{product ? "Save item" : "Add item"}</button></div>
    </form>
  );
}
