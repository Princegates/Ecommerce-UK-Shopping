/**
 * Plain-language labels for the review flags the quote engine raises when an order is priced. Staff only: these never appear
 * to customers. A flag is "kind" or "kind:detail".
 */
const LABELS: Record<string, string> = {
  unknown_category: "An item has no duty category, so it was charged at the highest planning rate. Set its category on the item.",
  manual_review: "Needs a manual check before buying (an unclassified or sensitive item).",
  fda_rules: "Health or beauty item: check the Food and Drugs Authority rules before buying.",
  high_value_review: "High-value item (phone, laptop, camera, watch): confirm the customs value before buying.",
  over_weight_limit: "An item is over the weight limit for one parcel.",
  below_minimum_order: "The items are below the minimum order.",
  sea_not_available_using_air: "Economy sea was asked for but not available, so it went by air.",
  floor_topup: "The service charge was raised to keep the order above the contribution floor.",
};

export type OrderFlag = { kind: string; detail: string; label: string; blocking: boolean };

export function describeFlags(flags: string[]): OrderFlag[] {
  const seen = new Set<string>();
  const out: OrderFlag[] = [];
  for (const f of flags) {
    const [kind, ...rest] = f.split(":");
    const detail = rest.join(":");
    if (seen.has(kind)) continue;
    seen.add(kind);
    const label = LABELS[kind];
    if (!label) continue;
    out.push({ kind, detail, label: kind === "floor_topup" && detail ? `${label} (GH₵${detail} added)` : label, blocking: kind === "over_weight_limit" });
  }
  return out;
}

/** The ones a person should look at before buying (a floor top-up is only a note about the margin). */
export const needsLookingAt = (flags: OrderFlag[]) => flags.filter((f) => f.kind !== "floor_topup" && f.kind !== "sea_not_available_using_air" && f.kind !== "below_minimum_order");
