import type Database from "better-sqlite3";
import { db } from "./db";
import type { OptionGroup } from "./catalog";
import type { RateCard } from "./pricing";
import { slugify } from "./slug";

type Db = Database.Database;

function uniqueSlug(table: "shops" | "products", base: string, ignoreId: number, d: Db): string {
  const root = slugify(base) || "item";
  let slug = root;
  for (let n = 2; ; n++) {
    const hit = d.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id <> ?`).get(slug, ignoreId);
    if (!hit) return slug;
    slug = `${root}-${n}`;
  }
}

export type ShopInput = {
  id: number; // 0 = create
  name: string;
  tagline: string;
  category: string;
  websiteUrl: string;
  description: string;
  accent: string;
  active: boolean;
  sort: number;
};

export function upsertShop(s: ShopInput, d: Db = db()): number {
  if (s.id > 0) {
    d.prepare(
      `UPDATE shops SET name=@name, tagline=@tagline, category=@category, website_url=@websiteUrl,
         description=@description, accent=@accent, active=@active, sort=@sort WHERE id=@id`,
    ).run({ ...s, active: s.active ? 1 : 0 });
    return s.id;
  }
  const slug = uniqueSlug("shops", s.name, 0, d);
  const info = d
    .prepare(
      `INSERT INTO shops (slug, name, tagline, category, website_url, description, accent, active, sort)
       VALUES (@slug, @name, @tagline, @category, @websiteUrl, @description, @accent, @active, @sort)`,
    )
    .run({ ...s, slug, active: s.active ? 1 : 0 });
  return Number(info.lastInsertRowid);
}

export type ProductInput = {
  id: number; // 0 = create
  shopId: number;
  name: string;
  brand: string;
  category: string;
  description: string;
  priceMinor: number;
  weightGrams: number;
  options: OptionGroup[];
  imageUrl: string;
  sourceUrl: string;
  active: boolean;
  /** The higher "was" price shown struck through, in pence. Null for no deal. */
  compareAtMinor: number | null;
  /** UTC "YYYY-MM-DD HH:MM:SS" when the deal ends, or null for no end. */
  dealEndsAt: string | null;
};

export function upsertProduct(p: ProductInput, d: Db = db()): number {
  const shop = d.prepare("SELECT slug FROM shops WHERE id = ?").get(p.shopId) as { slug: string } | undefined;
  if (!shop) throw new Error("Unknown shop");
  const row = {
    ...p,
    options: JSON.stringify(p.options),
    imageUrl: p.imageUrl || null,
    active: p.active ? 1 : 0,
  };
  if (p.id > 0) {
    d.prepare(
      `UPDATE products SET shop_id=@shopId, name=@name, brand=@brand, category=@category, description=@description,
         price_minor=@priceMinor, weight_grams=@weightGrams, options=@options, image_url=@imageUrl,
         source_url=@sourceUrl, active=@active, compare_at_minor=@compareAtMinor, deal_ends_at=@dealEndsAt WHERE id=@id`,
    ).run(row);
    return p.id;
  }
  const slug = uniqueSlug("products", `${shop.slug}-${p.name}`, 0, d);
  const info = d
    .prepare(
      `INSERT INTO products (shop_id, slug, name, brand, category, description, price_minor, weight_grams, options, image_url, source_url, active, compare_at_minor, deal_ends_at)
       VALUES (@shopId, @slug, @name, @brand, @category, @description, @priceMinor, @weightGrams, @options, @imageUrl, @sourceUrl, @active, @compareAtMinor, @dealEndsAt)`,
    )
    .run({ ...row, slug });
  return Number(info.lastInsertRowid);
}

export type ZoneInput = { id: number; name: string; areas: string; feeMinor: number; eta: string; active: boolean; sort: number };

export function upsertZone(z: ZoneInput, d: Db = db()): void {
  const row = { ...z, active: z.active ? 1 : 0 };
  if (z.id > 0) {
    d.prepare("UPDATE delivery_zones SET name=@name, areas=@areas, fee_minor=@feeMinor, eta=@eta, active=@active, sort=@sort WHERE id=@id").run(row);
  } else {
    d.prepare("INSERT INTO delivery_zones (name, areas, fee_minor, eta, active, sort) VALUES (@name, @areas, @feeMinor, @eta, @active, @sort)").run(row);
  }
}

export type MethodInput = { id: number; code: string; name: string; eta: string; rateCard: RateCard; active: boolean; sort: number };

export function upsertMethod(m: MethodInput, d: Db = db()): { ok: true } | { ok: false; error: string } {
  const card = JSON.stringify(m.rateCard);
  if (m.id > 0) {
    d.prepare("UPDATE shipping_methods SET name=?, eta=?, rate_card=?, active=?, sort=? WHERE id=?").run(
      m.name, m.eta, card, m.active ? 1 : 0, m.sort, m.id,
    );
    return { ok: true };
  }
  const code = m.code || slugify(m.name);
  if (d.prepare("SELECT id FROM shipping_methods WHERE code = ? OR LOWER(name) = LOWER(?)").get(code, m.name)) {
    return { ok: false, error: "A shipping method with that name already exists." };
  }
  d.prepare("INSERT INTO shipping_methods (code, name, eta, rate_card, active, sort) VALUES (?, ?, ?, ?, ?, ?)").run(
    code, m.name, m.eta, card, m.active ? 1 : 0, m.sort,
  );
  return { ok: true };
}

export type LinkRequest = {
  id: number;
  url: string;
  title: string;
  details: string;
  quantity: number;
  priceSeen: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  adminNote: string;
  createdAt: string;
};

export const REQUEST_STATUSES = ["NEW", "QUOTED", "WAITING_CUSTOMER", "ORDERED", "REJECTED"] as const;

export function listLinkRequests(d: Db = db()): LinkRequest[] {
  const rows = d.prepare("SELECT * FROM link_requests ORDER BY (status = 'NEW') DESC, id DESC LIMIT 300").all() as {
    id: number; url: string; title: string; details: string; quantity: number; price_seen: string; name: string;
    phone: string; email: string; status: string; admin_note: string; created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id, url: r.url, title: r.title, details: r.details, quantity: r.quantity, priceSeen: r.price_seen,
    name: r.name, phone: r.phone, email: r.email, status: r.status, adminNote: r.admin_note, createdAt: r.created_at,
  }));
}

export function updateLinkRequest(id: number, status: string, note: string, d: Db = db()): boolean {
  if (!(REQUEST_STATUSES as readonly string[]).includes(status)) return false;
  return d.prepare("UPDATE link_requests SET status = ?, admin_note = ? WHERE id = ?").run(status, note.slice(0, 500), id).changes > 0;
}

export function newRequestCount(d: Db = db()): number {
  return (d.prepare("SELECT COUNT(*) AS n FROM link_requests WHERE status = 'NEW'").get() as { n: number }).n;
}
