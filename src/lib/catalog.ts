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
};

type ShopRow = {
  id: number; slug: string; name: string; tagline: string; category: string; website_url: string;
  description: string; accent: string; active: number; product_count: number;
};

type ProductRow = {
  id: number; slug: string; name: string; brand: string; category: string; description: string;
  price_minor: number; weight_grams: number; options: string; image_url: string | null; source_url: string;
  active: number; shop_id: number; shop_slug: string; shop_name: string; shop_accent: string;
};

const SHOP_SQL = `
  SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.active = 1) AS product_count
  FROM shops s`;

const PRODUCT_SQL = `
  SELECT p.*, s.slug AS shop_slug, s.name AS shop_name, s.accent AS shop_accent
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
  shopId: r.shop_id, shopSlug: r.shop_slug, shopName: r.shop_name, shopAccent: r.shop_accent,
});

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
