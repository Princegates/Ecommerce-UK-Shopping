"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomer, safeNext } from "@/lib/customer-session";
import { setDefaultZone } from "@/lib/customers";
import { ZONE_COOKIE } from "@/lib/delivery-context";
import { getZone } from "@/lib/settings";

/** Remember the area to show delivery prices for. Signed-in customers also keep it as their default. */
export async function setDeliveryZoneAction(formData: FormData): Promise<void> {
  const zone = getZone(Number(formData.get("zoneId")));
  const back = safeNext(String(formData.get("back") ?? ""), "/");
  if (!zone) redirect(back);
  const jar = await cookies();
  jar.set(ZONE_COOKIE, String(zone.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  const customer = await getCustomer();
  if (customer) setDefaultZone(customer.id, zone.id);
  revalidatePath("/", "layout");
  redirect(back);
}
