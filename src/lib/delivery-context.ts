import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getCustomer } from "./customer-session";
import { buildDeliveryContext, type DeliveryContext } from "./landed";

export const ZONE_COOKIE = "dz";

/** The "Deliver to" area for this visitor: their choice, else their saved default, else the first area. */
export const getDeliveryContext = cache(async (): Promise<DeliveryContext | null> => {
  const jar = await cookies();
  const fromCookie = Number(jar.get(ZONE_COOKIE)?.value);
  const customer = await getCustomer();
  const preferred = Number.isInteger(fromCookie) && fromCookie > 0 ? fromCookie : customer?.defaultZoneId ?? null;
  return buildDeliveryContext(preferred);
});
