import "server-only";
import { getCustomer } from "./customer-session";
import { getDeliveryContext } from "./delivery-context";
import type { Customer } from "./customers";
import type { DeliveryContext } from "./landed";
import type { FxConfig } from "./pricing";
import { getSettings } from "./settings";
import { wishlistIds } from "./wishlist";

export type Shopper = { customer: Customer | null; ctx: DeliveryContext | null; fx: FxConfig; saved: Set<number> };

/** Everything a page needs to show prices and hearts the way this visitor should see them. */
export async function getShopper(): Promise<Shopper> {
  const [customer, ctx] = await Promise.all([getCustomer(), getDeliveryContext()]);
  return { customer, ctx, fx: getSettings().fx, saved: wishlistIds(customer?.id ?? null) };
}
