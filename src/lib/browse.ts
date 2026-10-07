import type { Query, SortKey } from "./catalog";
import { ghsToGbpMinor, type FxConfig } from "./pricing";

export const PAGE_SIZE = 24;

export const SORTS: [SortKey, string][] = [
  ["popular", "Featured"],
  ["price-asc", "Price: low to high"],
  ["price-desc", "Price: high to low"],
  ["rating", "Best rated"],
  ["newest", "Newest"],
  ["discount", "Biggest discount"],
];

export type BrowseParams = {
  q: string;
  /** Department slugs. */
  d: string[];
  /** Shop slugs. */
  shop: string[];
  /** Product categories. */
  cat: string[];
  /** Price bounds in cedis, as typed. */
  min: string;
  max: string;
  deals: boolean;
  sort: SortKey;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;

const many = (v: string | string[] | undefined, limit = 30): string[] =>
  (Array.isArray(v) ? v : v ? [v] : []).map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 80).slice(0, limit);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Read the address bar. Anything unexpected becomes a safe default. */
export function parseBrowse(sp: Raw): BrowseParams {
  const sort = one(sp.sort);
  const page = Number.parseInt(one(sp.page), 10);
  const money = (s: string) => (/^\d{1,7}(\.\d{1,2})?$/.test(s.trim()) ? s.trim() : "");
  return {
    q: one(sp.q).trim().slice(0, 80),
    d: many(sp.d),
    shop: many(sp.shop),
    cat: many(sp.cat, 60),
    min: money(one(sp.min)),
    max: money(one(sp.max)),
    deals: one(sp.deals) === "1",
    sort: (SORTS.find(([k]) => k === sort)?.[0] ?? "popular") as SortKey,
    page: Number.isInteger(page) && page >= 1 && page <= 500 ? page : 1,
  };
}

/** Turn what the shopper chose into a catalogue query. Prices typed in cedis become pounds at the current rate. */
export function toQuery(p: BrowseParams, fx: FxConfig, departmentNames: Map<string, string>, fixedDepartments?: string[]): Query {
  const cedisToGbp = (s: string) => (s ? ghsToGbpMinor(Math.round(parseFloat(s) * 100), fx) : undefined);
  const departments = fixedDepartments ?? p.d.map((slug) => departmentNames.get(slug)).filter((n): n is string => Boolean(n));
  return {
    q: p.q || undefined,
    departments: departments.length ? departments : undefined,
    shopSlugs: p.shop.length ? p.shop : undefined,
    categories: p.cat.length ? p.cat : undefined,
    minGbpMinor: cedisToGbp(p.min),
    maxGbpMinor: cedisToGbp(p.max),
    dealsOnly: p.deals || undefined,
    sort: p.sort,
    limit: PAGE_SIZE,
    offset: (p.page - 1) * PAGE_SIZE,
  };
}

/** A link to the same page with some choices changed. Changing a filter returns to page 1. */
export function browseHref(basePath: string, p: BrowseParams, patch: Partial<BrowseParams> = {}): string {
  const n: BrowseParams = { ...p, ...patch, page: patch.page ?? 1 };
  const q = new URLSearchParams();
  if (n.q) q.set("q", n.q);
  for (const v of n.d) q.append("d", v);
  for (const v of n.shop) q.append("shop", v);
  for (const v of n.cat) q.append("cat", v);
  if (n.min) q.set("min", n.min);
  if (n.max) q.set("max", n.max);
  if (n.deals) q.set("deals", "1");
  if (n.sort !== "popular") q.set("sort", n.sort);
  if (n.page > 1) q.set("page", String(n.page));
  const s = q.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export const without = (list: string[], v: string) => list.filter((x) => x !== v);
