"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCustomer, safeNext } from "@/lib/customer-session";
import { toggleWishlist } from "@/lib/wishlist";

/** Save or unsave an item. Visitors who are not signed in are sent to sign in and brought back. */
export async function toggleWishlistAction(formData: FormData): Promise<void> {
  const back = safeNext(String(formData.get("back") ?? ""), "/");
  const customer = await getCustomer();
  if (!customer) redirect(`/login?next=${encodeURIComponent(back)}`);
  toggleWishlist(customer.id, Number(formData.get("productId")));
  revalidatePath("/", "layout");
  redirect(back);
}
