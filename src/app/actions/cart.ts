"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addToCart, ensureCartToken, readCartToken, removeItem, setQuantity } from "@/lib/cart";
import { requireCustomer } from "@/lib/customer-session";
import { reorderableItems } from "@/lib/orders";

export type AddState = { error?: string; added?: boolean; nonce?: number };

export async function addToCartAction(_prev: AddState, formData: FormData): Promise<AddState> {
  const productId = Number(formData.get("productId"));
  const quantity = Number(formData.get("quantity"));
  const chosen: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("opt:") && typeof v === "string") chosen[k.slice(4)] = v;
  }
  if (!Number.isInteger(productId)) return { error: "This item is no longer available." };
  const token = await ensureCartToken();
  const res = addToCart(token, productId, quantity, chosen);
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  return { added: true, nonce: Date.now() };
}

export async function updateQuantityAction(formData: FormData): Promise<void> {
  const token = await readCartToken();
  if (!token) return;
  setQuantity(token, Number(formData.get("itemId")), Number(formData.get("quantity")));
  revalidatePath("/", "layout");
}

export async function removeItemAction(formData: FormData): Promise<void> {
  const token = await readCartToken();
  if (!token) return;
  removeItem(token, Number(formData.get("itemId")));
  revalidatePath("/", "layout");
}

export async function goToCheckoutAction(formData: FormData): Promise<void> {
  const zone = Number(formData.get("zone"));
  const ship = String(formData.get("ship") ?? "");
  const q = new URLSearchParams();
  if (Number.isInteger(zone) && zone > 0) q.set("zone", String(zone));
  if (/^[a-z0-9_-]{1,40}$/.test(ship)) q.set("ship", ship);
  redirect(`/checkout${q.size ? `?${q}` : ""}`);
}

/** Put the still-available items of one of the customer's past orders back in the cart. */
export async function buyAgainAction(formData: FormData): Promise<void> {
  const customer = await requireCustomer("/account/orders");
  const items = reorderableItems(customer.id, String(formData.get("number") ?? ""));
  if (items.length === 0) redirect("/account/orders?error=" + encodeURIComponent("Those items are no longer available."));
  const token = await ensureCartToken();
  let added = 0;
  for (const i of items) if (addToCart(token, i.productId, i.quantity, i.options).ok) added++;
  revalidatePath("/", "layout");
  redirect(added > 0 ? "/cart" : "/account/orders?error=" + encodeURIComponent("Those items are no longer available."));
}
