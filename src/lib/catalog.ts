import type Database from "better-sqlite3";
import { db } from "./db";

type Db = Database.Database;

export type OptionGroup = { name: string; values: string[] };

export type Shop = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  websiteUrl: string;
  description: string;
  accent: string;
  active: boolean;
  productCount: number;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  priceMinor: number;
  weightGrams: number;
  options: OptionGroup[];
  imageUrl: string | null;
  sourceUrl: string;
  active: boolean;
  shopId: number;
  shopSlug: string;
  shopName: string;
  shopAccent: string;
  shopCategory: string;
  compareAtMinor: number | null;
  dealEndsAt: string | null;
  reviewCount: number;
  ratingAvg: number | null;
  createdAt: string;
};

type ShopRow = {
  id: number; slug: string; name: string; tagline: string; category: string; website_url: string;
  description: string; accent: string; active: number; product_count: number;
};

type ProductRow = {
  id: number; slug: string; name: string; brand: string; category: string; description: string;
  price_minor: number; weight_grams: number; options: string; image_url: string | null; source_url: string;
  active: number; shop_id: number; shop_slug: string; shop_name: string; shop_accent: string; shop_category: string;
  compare_at_minor: number | null; deal_ends_at: string | null; review_count: number; review_avg: number | null; created_at: string;
};

const SHOP_SQL = `
  SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.active = 1) AS product_count
  FROM shops s`;

const PRODUCT_SQL = `
  SELECT p.*, s.slug AS shop_slug, s.name AS shop_name, s.accent AS shop_accent, s.category AS shop_category,
    (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.status = 'PUBLISHED') AS review_count,
    (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id AND r.status = 'PUBLISHED') AS review_avg
  FROM products p JOIN shops s ON s.id = p.shop_id`;

const toShop = (r: ShopRow): Shop => ({
  id: r.id, slug: r.slug, name: r.name, tagline: r.tagline, category: r.category, websiteUrl: r.website_url,
  description: r.description, accent: r.accent, active: r.active === 1, productCount: r.product_count,
});

export function parseOptions(raw: string): OptionGroup[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((g) => g && typeof g.name === "string" && Array.isArray(g.values))
      .map((g) => ({ name: String(g.name), values: g.values.map(String) }));
  } catch {
    return [];
  }
}

const toProduct = (r: ProductRow): Product => ({
  id: r.id, slug: r.slug, name: r.name, brand: r.brand, category: r.category, description: r.description,
  priceMinor: r.price_minor, weightGrams: r.weight_grams, options: parseOptions(r.options),
  imageUrl: r.image_url, sourceUrl: r.source_url, active: r.active === 1,
  shopId: r.shop_id, shopSlug: r.shop_slug, shopName: r.shop_name, shopAccent: r.shop_accent, shopCategory: r.shop_category,
  compareAtMinor: r.compare_at_minor && r.compare_at_minor > r.price_minor ? r.compare_at_minor : null,
  dealEndsAt: r.deal_ends_at, reviewCount: r.review_count, ratingAvg: r.review_avg === null ? null : Math.round(r.review_avg * 10) / 10,
  createdAt: r.created_at,
});

/** A deal is live while there is a higher "was" price and the end time, if one is set, has not passed. */
export function isDealLive(p: Pick<Product, "priceMinor" | "compareAtMinor" | "dealEndsAt">, now = new Date()): boolean {
  if (!p.compareAtMinor || p.compareAtMinor <= p.priceMinor) return false;
  if (!p.dealEndsAt) return true;
  const end = Date.parse(p.dealEndsAt.includes("T") ? p.dealEndsAt : `${p.dealEndsAt.replace(" ", "T")}Z`);
  return Number.isFinite(end) && end > now.getTime();
}

export function dealPercent(p: Pick<Product, "priceMinor" | "compareAtMinor">): number {
  return p.compareAtMinor && p.compareAtMinor > p.priceMinor ? Math.round((1 - p.priceMinor / p.compareAtMinor) * 100) : 0;
}

export function listShops(opts: { includeInactive?: boolean; category?: string } = {}, d: Db = db()): Shop[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (!opts.includeInactive) where.push("s.active = 1");
  if (opts.category) {
    where.push("s.category = ?");
    args.push(opts.category);
  }
  const sql = `${SHOP_SQL} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY s.sort, s.name`;
  return (d.prepare(sql).all(...args) as ShopRow[]).map(toShop);
}

export function shopCategories(d: Db = db()): string[] {
  return (d.prepare("SELECT DISTINCT category FROM shops WHERE active = 1 ORDER BY category").all() as { category: string }[]).map(
    (r) => r.category,
  );
}

export function getShop(slug: string, d: Db = db()): Shop | null {
  const r = d.prepare(`${SHOP_SQL} WHERE s.slug = ? AND s.active = 1`).get(slug) as ShopRow | undefined;
  return r ? toShop(r) : null;
}

export function getShopById(id: number, d: Db = db()): Shop | null {
  const r = d.prepare(`${SHOP_SQL} WHERE s.id = ?`).get(id) as ShopRow | undefined;
  return r ? toShop(r) : null;
}

export type ProductSort = "popular" | "price-asc" | "price-desc" | "name";

const ORDER: Record<ProductSort, string> = {
  popular: "p.id",
  "price-asc": "p.price_minor ASC, p.id",
  "price-desc": "p.price_minor DESC, p.id",
  name: "p.name COLLATE NOCASE",
};

export function listProducts(
  opts: { shopId?: number; category?: string; q?: string; sort?: ProductSort; limit?: number; includeInactive?: boolean } = {},
  d: Db = db(),
): Product[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (!opts.includeInactive) where.push("p.active = 1 AND s.active = 1");
  if (opts.shopId) {
    where.push("p.shop_id = ?");
    args.push(opts.shopId);
  }
  if (opts.category) {
    where.push("p.category = ?");
    args.push(opts.category);
  }
  if (opts.q?.trim()) {
    for (const term of opts.q.trim().toLowerCase().split(/\s+/).slice(0, 6)) {
      where.push("(LOWER(p.name) LIKE ? ESCAPE '\\' OR LOWER(p.brand) LIKE ? ESCAPE '\\' OR LOWER(p.category) LIKE ? ESCAPE '\\' OR LOWER(s.name) LIKE ? ESCAPE '\\')");
      const like = `%${term.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
      args.push(like, like, like, like);
    }
  }
  const sql = `${PRODUCT_SQL} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${ORDER[opts.sort ?? "popular"]} ${opts.limit ? "LIMIT " + Math.floor(opts.limit) : ""}`;
  return (d.prepare(sql).all(...args) as ProductRow[]).map(toProduct);
}

export function productCategoriesForShop(shopId: number, d: Db = db()): string[] {
  return (
    d
      .prepare("SELECT DISTINCT category FROM products WHERE shop_id = ? AND active = 1 AND category <> '' ORDER BY category")
      .all(shopId) as { category: string }[]
  ).map((r) => r.category);
}

export function getProduct(slug: string, d: Db = db()): Product | null {
  const r = d.prepare(`${PRODUCT_SQL} WHERE p.slug = ? AND p.active = 1 AND s.active = 1`).get(slug) as ProductRow | undefined;
  return r ? toProduct(r) : null;
}

export function getProductById(id: number, d: Db = db()): Product | null {
  const r = d.prepare(`${PRODUCT_SQL} WHERE p.id = ? AND p.active = 1 AND s.active = 1`).get(id) as ProductRow | undefined;
  return r ? toProduct(r) : null;
}

export function relatedProducts(product: Product, limit = 4, d: Db = db()): Product[] {
  const rows = d
    .prepare(`${PRODUCT_SQL} WHERE p.shop_id = ? AND p.id <> ? AND p.active = 1 ORDER BY (p.category = ?) DESC, p.id LIMIT ?`)
    .all(product.shopId, product.id, product.category, limit) as ProductRow[];
  return rows.map(toProduct);
}

export function allProductsAdmin(d: Db = db()): Product[] {
  return listProducts({ includeInactive: true }, d);
}

/** A spread of items across shops (round robin), for the home page. */
export function featuredProducts(limit = 8, d: Db = db()): Product[] {
  const byShop = new Map<number, Product[]>();
  for (const p of listProducts({ sort: "popular" }, d)) {
    const list = byShop.get(p.shopId) ?? [];
    list.push(p);
    byShop.set(p.shopId, list);
  }
  const queues = [...byShop.values()];
  const out: Product[] = [];
  for (let round = 0; out.length < limit; round++) {
    let added = false;
    for (const q of queues) {
      if (q[round] && out.length < limit) {
        out.push(q[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}


// ------------------------------------------------------------------ discovery

export type SortKey = ProductSort | "newest" | "rating" | "discount";

export type Query = {
  q?: string;
  shopSlugs?: string[];
  /** Shop categories, such as "Fashion". */
  departments?: string[];
  /** Product categories, such as "Trainers". */
  categories?: string[];
  minGbpMinor?: number;
  maxGbpMinor?: number;
  dealsOnly?: boolean;
  sort?: SortKey;
  limit?: number;
  offset?: number;
};

export type Facets = {
  shops: { slug: string; name: string; count: number }[];
  departments: { name: string; count: number }[];
  categories: { name: string; count: number }[];
  priceMinGbp: number;
  priceMaxGbp: number;
};

const SORT_SQL: Record<SortKey, string> = {
  popular: "p.id",
  "price-asc": "p.price_minor ASC, p.id",
  "price-desc": "p.price_minor DESC, p.id",
  name: "p.name COLLATE NOCASE",
  newest: "p.created_at DESC, p.id DESC",
  rating: "review_avg DESC NULLS LAST, review_count DESC, p.id",
  discount: "(CASE WHEN p.compare_at_minor > p.price_minor THEN 1.0 - (p.price_minor * 1.0 / p.compare_at_minor) ELSE 0 END) DESC, p.id",
};

function where(q: Query, skip: "shops" | "departments" | "categories" | "price" | null = null): { sql: string; args: unknown[] } {
  const w: string[] = ["p.active = 1", "s.active = 1"];
  const args: unknown[] = [];
  const inList = (col: string, vals: string[]) => {
    w.push(`${col} IN (${vals.map(() => "?").join(",")})`);
    args.push(...vals);
  };
  if (q.q?.trim()) {
    for (const term of q.q.trim().toLowerCase().split(/\s+/).slice(0, 6)) {
      w.push("(LOWER(p.name) LIKE ? ESCAPE '\\' OR LOWER(p.brand) LIKE ? ESCAPE '\\' OR LOWER(p.category) LIKE ? ESCAPE '\\' OR LOWER(s.name) LIKE ? ESCAPE '\\' OR LOWER(s.category) LIKE ? ESCAPE '\\')");
      const like = `%${term.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
      args.push(like, like, like, like, like);
    }
  }
  if (skip !== "shops" && q.shopSlugs?.length) inList("s.slug", q.shopSlugs.slice(0, 30));
  if (skip !== "departments" && q.departments?.length) inList("s.category", q.departments.slice(0, 30));
  if (skip !== "categories" && q.categories?.length) inList("p.category", q.categories.slice(0, 60));
  if (skip !== "price") {
    if (q.minGbpMinor && q.minGbpMinor > 0) { w.push("p.price_minor >= ?"); args.push(Math.floor(q.minGbpMinor)); }
    if (q.maxGbpMinor && q.maxGbpMinor > 0) { w.push("p.price_minor <= ?"); args.push(Math.floor(q.maxGbpMinor)); }
  }
  if (q.dealsOnly) w.push("p.compare_at_minor > p.price_minor AND (p.deal_ends_at IS NULL OR p.deal_ends_at > datetime('now'))");
  return { sql: w.join(" AND "), args };
}

/** Search and browse with filters. Facet counts ignore their own filter, so shoppers can widen a choice. */
export function queryProducts(q: Query, d: Db = db()): { items: Product[]; total: number; facets: Facets } {
  const main = where(q);
  const total = (d.prepare(`SELECT COUNT(*) AS n FROM products p JOIN shops s ON s.id = p.shop_id WHERE ${main.sql}`).get(...main.args) as { n: number }).n;
  const limit = Math.min(Math.max(Math.floor(q.limit ?? 24), 1), 100);
  const offset = Math.max(Math.floor(q.offset ?? 0), 0);
  const items = (
    d.prepare(`${PRODUCT_SQL} WHERE ${main.sql} ORDER BY ${SORT_SQL[q.sort ?? "popular"]} LIMIT ? OFFSET ?`).all(...main.args, limit, offset) as ProductRow[]
  ).map(toProduct);

  const count = (col: string, nameAlias: string, extra: string, skip: "shops" | "departments" | "categories") => {
    const w = where(q, skip);
    return d
      .prepare(`SELECT ${col} AS key, ${extra} COUNT(*) AS n FROM products p JOIN shops s ON s.id = p.shop_id WHERE ${w.sql} AND ${nameAlias} <> '' GROUP BY ${col} ORDER BY n DESC, key LIMIT 40`)
      .all(...w.args) as Record<string, string | number>[];
  };
  const shopRows = count("s.slug", "s.name", "s.name AS name,", "shops");
  const depRows = count("s.category", "s.category", "", "departments");
  const catRows = count("p.category", "p.category", "", "categories");
  const pw = where(q, "price");
  const range = d.prepare(`SELECT MIN(p.price_minor) AS lo, MAX(p.price_minor) AS hi FROM products p JOIN shops s ON s.id = p.shop_id WHERE ${pw.sql}`).get(...pw.args) as { lo: number | null; hi: number | null };

  return {
    items,
    total,
    facets: {
      shops: shopRows.map((r) => ({ slug: String(r.key), name: String(r.name), count: Number(r.n) })),
      departments: depRows.map((r) => ({ name: String(r.key), count: Number(r.n) })),
      categories: catRows.map((r) => ({ name: String(r.key), count: Number(r.n) })),
      priceMinGbp: range.lo ?? 0,
      priceMaxGbp: range.hi ?? 0,
    },
  };
}

export function dealProducts(limit = 12, d: Db = db()): Product[] {
  return queryProducts({ dealsOnly: true, sort: "discount", limit }, d).items;
}

export function newArrivals(limit = 12, d: Db = db()): Product[] {
  return queryProducts({ sort: "newest", limit }, d).items;
}

export function productsByIds(ids: number[], d: Db = db()): Product[] {
  const clean = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 24);
  if (clean.length === 0) return [];
  const rows = d.prepare(`${PRODUCT_SQL} WHERE p.id IN (${clean.map(() => "?").join(",")}) AND p.active = 1 AND s.active = 1`).all(...clean) as ProductRow[];
  const byId = new Map(rows.map((r) => [r.id, toProduct(r)]));
  return clean.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

export type Department = { name: string; slug: string; shops: number; products: number; accent: string };

export function listDepartments(d: Db = db()): Department[] {
  const rows = d
    .prepare(
      `SELECT s.category AS name, COUNT(DISTINCT s.id) AS shops,
         (SELECT COUNT(*) FROM products p JOIN shops s2 ON s2.id = p.shop_id WHERE s2.category = s.category AND p.active = 1 AND s2.active = 1) AS products,
         MIN(s.accent) AS accent
       FROM shops s WHERE s.active = 1 AND s.category <> '' GROUP BY s.category ORDER BY s.category`,
    )
    .all() as { name: string; shops: number; products: number; accent: string }[];
  return rows.map((r) => ({ ...r, slug: departmentSlug(r.name) }));
}

export const departmentSlug = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function departmentFromSlug(slug: string, d: Db = db()): Department | null {
  return listDepartments(d).find((x) => x.slug === slug) ?? null;
}
