import { beforeEach, describe, expect, it } from "vitest";
import { openForTest } from "../db";
import { listShops } from "../catalog";
import { resetHostClock, type Fetcher, type HttpResponse } from "./net";
import { previewSource, runSource, type IngestDeps } from "./run";
import { listImportItems, saveSource } from "./store";
import { mapWooProduct } from "./woocommerce";

const ORIGIN = "https://shop.example";
const res = (status: number, body = "", headers: Record<string, string> = {}): HttpResponse => ({ status, headers, body: Buffer.from(body), truncated: false });

const prices = (over: Record<string, unknown> = {}) => ({ price: "4500", regular_price: "6000", currency_code: "GBP", currency_minor_unit: 2, price_range: null, ...over });
const product = (over: Record<string, unknown> = {}) => ({
  id: 111, name: "Linen Shirt", type: "variable", permalink: "https://shop.example/product/linen-shirt/", description: "<p>Soft &amp; light</p>", short_description: "",
  is_in_stock: true, prices: prices({ price_range: { min_amount: "4500", max_amount: "4500" } }),
  images: [{ src: "https://shop.example/wp-content/uploads/shirt.jpg" }], categories: [{ name: "Shirts" }], brands: [{ name: "Brand" }],
  attributes: [
    { name: "Size", has_variations: true, terms: [{ name: "S" }, { name: "M" }] },
    { name: "Material", has_variations: false, terms: [{ name: "Linen" }] },
  ],
  ...over,
});

describe("mapWooProduct", () => {
  it("maps a product with its photo, was-price, stock and size choices (not fixed attributes)", () => {
    expect(mapWooProduct(product(), ORIGIN)).toEqual({
      item: {
        externalId: "woocommerce-111", productUrl: "https://shop.example/product/linen-shirt/", name: "Linen Shirt", brand: "Brand", category: "Shirts",
        description: "Soft & light", priceMinor: 4500, compareAtMinor: 6000, imageUrl: "https://shop.example/wp-content/uploads/shirt.jpg", inStock: true, weightGrams: null,
        options: [{ name: "Size", values: ["S", "M"] }],
      },
    });
  });

  it("has no was-price when the regular price is not higher, and reports sold-out products", () => {
    const r = mapWooProduct(product({ prices: prices({ regular_price: "4500" }), is_in_stock: false }), ORIGIN);
    expect(r).toMatchObject({ item: { compareAtMinor: null, inStock: false } });
  });

  it("skips what it cannot price or link honestly", () => {
    const skip = (over: Record<string, unknown>) => mapWooProduct(product(over), ORIGIN);
    expect(skip({ prices: prices({ price_range: { min_amount: "1000", max_amount: "2000" } }) })).toEqual({ skip: "variants have different prices" });
    expect(skip({ prices: prices({ price: "45.00" }) })).toEqual({ skip: "no valid price" });
    expect(skip({ prices: prices({ currency_code: "USD" }) })).toEqual({ skip: "not priced in pounds" });
    expect(skip({ prices: prices({ currency_minor_unit: 0 }) })).toEqual({ skip: "not priced in pounds" });
    expect(skip({ type: "external" })).toEqual({ skip: "sold on another website" });
    expect(skip({ type: "grouped" })).toEqual({ skip: "grouped product" });
    expect(skip({ name: " " })).toEqual({ skip: "no title" });
    expect(skip({ id: undefined })).toEqual({ skip: "no product id" });
    expect(skip({ permalink: "" })).toEqual({ skip: "no link back to the product" });
    expect(skip({ permalink: "https://elsewhere.example/p/1" })).toEqual({ skip: "product link points to another website" });
  });

  it("accepts the www form of the same site and ignores a photo that is not a web address", () => {
    expect(mapWooProduct(product({ permalink: "https://www.shop.example/p/1" }), ORIGIN)).toHaveProperty("item");
    expect(mapWooProduct(product({ images: [{ src: "javascript:alert(1)" }] }), ORIGIN)).toMatchObject({ item: { imageUrl: "" } });
  });
});

function fake(opts: { robots?: string | number; pages?: unknown[][]; status?: number; totalHeader?: boolean; body?: string } = {}, log: string[] = []) {
  const pages = opts.pages ?? [[product(), product({ id: 222, name: "Wool Hat", permalink: "https://shop.example/product/wool-hat/", type: "simple", prices: prices({ price: "2000", regular_price: "2000" }), attributes: [] })]];
  const fetcher: Fetcher = async (u) => {
    const url = u.toString();
    log.push(url);
    if (url === `${ORIGIN}/robots.txt`) return typeof opts.robots === "number" ? res(opts.robots) : res(200, opts.robots ?? "User-agent: *\nDisallow: /cart\n");
    const m = /\/wp-json\/wc\/store\/v1\/products\?per_page=100&page=(\d+)$/.exec(url);
    if (m) {
      if (opts.status) return res(opts.status);
      if (opts.body !== undefined) return res(200, opts.body);
      const headers: Record<string, string> = opts.totalHeader ? { "x-wp-totalpages": String(pages.length) } : {};
      return res(200, JSON.stringify(pages[Number(m[1]) - 1] ?? []), headers);
    }
    return res(404);
  };
  const deps: IngestDeps = { fetcher, sleep: async () => {}, now: () => Date.parse("2026-10-07T12:00:00Z"), appUrl: "https://my.site" };
  return { deps, log };
}

function setup() {
  const d = openForTest();
  const shop = listShops({}, d)[0];
  const r = saveSource(
    {
      id: 0, shopId: shop.id, name: "Woo shop", kind: "woocommerce", url: ORIGIN, fieldMap: {}, termsUrl: "", termsNote: "Owner agreed by email", confirmTerms: true, enabled: true,
      autoPublishNew: true, autoApplyUpdates: true, maxPriceChangePct: 40, maxItems: 500, delayMs: 2000, intervalHours: 24, staleDays: 14, defaultCategory: "", defaultWeightGrams: 500,
    },
    d,
  );
  if (!r.ok) throw new Error(r.error);
  return { d, id: r.id, shop };
}

beforeEach(() => resetHostClock());

describe("WooCommerce source", () => {
  it("publishes products with their size choices, using the shop's own product link", async () => {
    const { d, id, shop } = setup();
    const f = fake();
    const r = await runSource(id, f.deps, d);
    expect(r).toMatchObject({ status: "OK", fetched: 2, created: 2 });
    const p = d.prepare("SELECT price_minor, compare_at_minor, options, source_url, active FROM products WHERE shop_id = ? AND name = 'Linen Shirt'").get(shop.id) as Record<string, unknown>;
    expect(p).toMatchObject({ price_minor: 4500, compare_at_minor: 6000, source_url: "https://shop.example/product/linen-shirt/", active: 1 });
    expect(JSON.parse(p.options as string)).toEqual([{ name: "Size", values: ["S", "M"] }]);
    expect(f.log).toContain(`${ORIGIN}/robots.txt`);
  });

  it("follows pages, and hides products the shop no longer lists", async () => {
    const full = Array.from({ length: 100 }, (_, i) => product({ id: 1000 + i, name: `Item ${i}`, permalink: `https://shop.example/product/item-${i}/`, type: "simple", prices: prices({ price: "1000", regular_price: "1000" }), attributes: [] }));
    const { d, id } = setup();
    const last = product({ id: 5000, name: "Last Item", permalink: "https://shop.example/product/last/", type: "simple", prices: prices({ price: "1100", regular_price: "1100" }), attributes: [] });
    const r = await runSource(id, fake({ pages: [full, [last]], totalHeader: true }).deps, d);
    expect(r).toMatchObject({ status: "OK", fetched: 101, created: 101 });
    const f2 = fake({ pages: [full.slice(0, 99)] });
    const r2 = await runSource(id, f2.deps, d);
    expect(r2.status).toBe("OK");
    expect(r2.removed).toBe(2);
    expect((d.prepare("SELECT COUNT(*) AS n FROM products WHERE name = 'Last Item' AND active = 1").get() as { n: number }).n).toBe(0);
  });

  it("does not ask for a page past the end when the shop says how many there are", async () => {
    const { d, id } = setup();
    const f = fake({ totalHeader: true });
    await runSource(id, f.deps, d);
    expect(f.log.filter((u) => u.includes("/products?")).length).toBe(1);
  });

  it("does not hide anything when it only read part of the list", async () => {
    const { d, id } = setup();
    await runSource(id, fake().deps, d);
    d.prepare("UPDATE catalog_sources SET max_items = 1 WHERE id = ?").run(id);
    const r = await runSource(id, fake().deps, d);
    expect(r.removed).toBe(0);
  });

  it("stops when robots.txt disallows the product list, and pauses the source", async () => {
    const { d, id } = setup();
    const f = fake({ robots: "User-agent: *\nDisallow: /wp-json/\n" });
    const r = await runSource(id, f.deps, d);
    expect(r.status).toBe("BLOCKED");
    expect(f.log.some((u) => u.includes("/wp-json/"))).toBe(false);
    expect(listImportItems({}, d).total).toBe(0);
  });

  it("stops when the shop refuses with 403 or 429, and does not try again by another route", async () => {
    for (const status of [403, 429]) {
      const { d, id } = setup();
      const f = fake({ status });
      expect((await runSource(id, f.deps, d)).status).toBe("BLOCKED");
      expect(f.log.filter((u) => u.includes("/products?")).length).toBe(1);
    }
  });

  it("explains a shop with no public product list, a non-pound shop and a page that is not a list", async () => {
    const a = setup();
    expect((await previewSource({ kind: "woocommerce", url: ORIGIN, fieldMap: {} }, fake({ status: 404 }).deps, a.d)).message).toMatch(/does not look like a WooCommerce shop/);
    const usd = [product({ prices: prices({ currency_code: "USD" }) })];
    expect((await previewSource({ kind: "woocommerce", url: ORIGIN, fieldMap: {} }, fake({ pages: [usd] }).deps, a.d)).message).toMatch(/prices in USD/);
    expect((await previewSource({ kind: "woocommerce", url: ORIGIN, fieldMap: {} }, fake({ body: "<html>login</html>" }).deps, a.d)).message).toMatch(/did not return a product list/);
  });

  it("previews without saving anything and reports what it skipped", async () => {
    const { d } = setup();
    const pages = [[product(), product({ id: 9, name: "Pick a size", prices: prices({ price_range: { min_amount: "1", max_amount: "2" } }) })]];
    const p = await previewSource({ kind: "woocommerce", url: ORIGIN, fieldMap: {} }, fake({ pages }).deps, d);
    expect(p).toMatchObject({ ok: true, totalRows: 1 });
    expect(p.skipNote).toMatch(/different prices/);
    expect(listImportItems({}, d).total).toBe(0);
  });
});
