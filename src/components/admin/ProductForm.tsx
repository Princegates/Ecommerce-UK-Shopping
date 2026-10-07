import { saveProductAction } from "@/app/admin/actions";
import { Area, Check, Select, Text } from "@/components/admin/ui";
import { optionGroupsToText } from "@/lib/admin-parse";
import type { Product, Shop } from "@/lib/catalog";
import { minorToInput } from "@/lib/money";

export default function ProductForm({ product, shops }: { product?: Product; shops: Shop[] }) {
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
      <Area label="Description" name="description" defaultValue={product?.description} rows={4} />
      <Area
        label="Options customers choose"
        name="options"
        mono
        rows={3}
        defaultValue={product ? optionGroupsToText(product.options) : ""}
        hint="One per line, like “Size: UK 7, UK 8, UK 9” or “Colour: Black, White”. Leave empty if there are none."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Link to the item on the shop's website" name="sourceUrl" defaultValue={product?.sourceUrl} placeholder="https://" />
        <Text label="Image link (only if you are licensed to use it)" name="imageUrl" defaultValue={product?.imageUrl ?? ""} placeholder="https://" />
      </div>
      <Check label="Show this item to customers" name="active" defaultChecked={product?.active ?? true} />
      <div><button className="btn btn-primary">{product ? "Save item" : "Add item"}</button></div>
    </form>
  );
}
