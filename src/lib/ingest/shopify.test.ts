import { beforeEach, describe, expect, it } from "vitest";
import { openForTest } from "../db";
import { listShops } from "../catalog";
import { resetHostClock, type Fetcher, type HttpResponse } from "./net";
import { previewSource, runSource, type IngestDeps } from "./run";
import { mapShopifyProduct, shopifyOrigin } from "./shopify";
import { listImportItems, saveSource } from "./store";

const ORIGIN = "https://brand.example";
const res = (status: number, body = ""): HttpResponse => ({ status, headers: {}, body: Buffer.from(body), truncated: false });

const product = (over: Record<string, unknown> = {}) => ({
  id: 111, title: "Linen Shirt", handle: "linen-shirt", body_html: "<p>Soft &amp; light</p>", vendor: "Brand", product_type: "Shirts",
  variants: [
    { id: 1, title: "S / White", price: "45.00", compare_at_price: "60.00", available: true, grams: 300 },
    { id: 2, title: "M / White", price: "45.00", compare_at_price: null, available: false, grams: 320 },
  ],
  images: [{ src: "https://cdn.shopify.com/s/files/1/shirt.jpg" }],
  options: [{ name: "Size", values: ["S", "M"] }, { name: "Colour", values: ["White"] }],
  ...over,
});

describe("mapShopifyProduct", () => {
  it("maps a product with its photo, was-price, stock, weight and size/colour choices", () => {
    expect(mapShopifyProduct(product(), ORIGIN)).toEqual({
      item: {
        externalId: "shopify-111", productUrl: "https://brand.example/products/linen-shirt", name: "Linen Shirt", brand: "Brand", category: "Shirts",
        description: "Soft & light", priceMinor: 4500, compareAtMinor: 6000, imageUrl: "https://cdn.shopify.com/s/files/1/shirt.jpg", inStock: true, weightGrams: 300,
        options: [{ name: "Size", values: ["S", "M"] }, { name: "Colour", values: ["White"] }],
      },
    });
  });

  it("drops the placeholder option and marks sold-out products out of stock", () => {
    const r = mapShopifyProduct(product({ options: [{ name: "Title", values: ["Default Title"] }], variants: [{ price: "9.99", available: false }] }), ORIGIN);
    expect(r).toMatchObject({ item: { options: [], inStock: false, compareAtMinor: null, weightGrams: null } });
  });

  it("skips what it cannot price honestly", () => {
    expect(mapShopifyProduct(product({ variants: [{ price: "10.00" }, { price: "12.00" }] }), ORIGIN)).toEqual({ skip: "variants have different prices" });
    expect(mapShopifyProduct(product({ variants: [{ price: "abc" }] }), ORIGIN)).toEqual({ skip: "no valid price" });
    expect(mapShopifyProduct(product({ variants: [] }), ORIGIN)).toEqual({ skip: "no variants" });
    expect(mapShopifyProduct(product({ title: " " }), ORIGIN)).toEqual({ skip: "no title" });
    expect(mapShopifyProduct(product({ handle: "" }), ORIGIN)).toEqual({ skip: "no link back to the product" });
    expect(mapShopifyProduct(product({ id: undefined }), ORIGIN)).toEqual({ skip: "no product id" });
  });

  it("ignores a photo that is not a web address", () => {
    expect(mapShopifyProduct(product({ images: [{ src: "javascript:alert(1)" }] }), ORIGIN)).toMatchObject({ item: { imageUrl: "" } });
  });
});

describe("shopifyOrigin", () => {
  it("keeps only the shop's own address and refuses unsafe ones", () => {
    expect(shopifyOrigin("brand.example/collections/all?x=1")).toBe("https://brand.example");
    expect(shopifyOrigin(" https://www.brand.example/ ")).toBe("https://www.brand.example");
    expect(() => shopifyOrigin("http://127.0.0.1")).toThrow();
    expect(() => shopifyOrigin("ftp://brand.example")).toThrow();
  });
});

function fake(opts: { robots?: string | number; currency?: string; pages?: unknown[][]; meta404?: boolean } = {}, log: string[] = []) {
  const pages = opts.pages ?? [[product(), product({ id: 222, title: "Wool Hat", handle: "wool-hat", variants: [{ price: "20.00", available: true, grams: 100 }], options: [] })]];
  const fetcher: Fetcher = async (u) => {
    const url = u.toString();
    log.push(url);
    if (url === `${ORIGIN}/robots.txt`) return typeof opts.robots === "number" ? res(opts.robots) : res(200, opts.robots ?? "User-agent: *\nDisallow: /cart\n");
    if (url === `${ORIGIN}/meta.json`) return opts.meta404 ? res(404) : res(200, JSON.stringify({ currency: opts.currency ?? "GBP" }));
    const m = /\/products\.json\?limit=250&page=(\d+)$/.exec(url);
    if (m) return res(200, JSON.stringify({ products: pages[Number(m[1]) - 1] ?? [] }));
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
      id: 0, shopId: shop.id, name: "Brand shop", kind: "shopify", url: ORIGIN, fieldMap: {}, termsUrl: "", termsNote: "Owner agreed by email", confirmTerms: true, enabled: true,
      autoPublishNew: true, autoApplyUpdates: true, maxPriceChangePct: 40, maxItems: 500, delayMs: 2000, intervalHours: 24, staleDays: 14, defaultCategory: "", defaultWeightGrams: 500,
    },
    d,
  );
  if (!r.ok) throw new Error(r.error);
  return { d, id: r.id, shop };
}

beforeEach(() => resetHostClock());

describe("Shopify source", () => {
  it("publishes products with their sizes and colours as choices, and identifies itself", async () => {
    const { d, id, shop } = setup();
    const f = fake();
    const r = await runSource(id, f.deps, d);
    expect(r).toMatchObject({ status: "OK", fetched: 2, created: 2 });
    const p = d.prepare("SELECT price_minor, compare_at_minor, options, image_url, source_url, active FROM products WHERE shop_id = ? AND name = 'Linen Shirt'").get(shop.id) as Record<string, unknown>;
    expect(p).toMatchObject({ price_minor: 4500, compare_at_minor: 6000, image_url: "https://cdn.shopify.com/s/files/1/shirt.jpg", source_url: "https://brand.example/products/linen-shirt", active: 1 });
    expect(JSON.parse(p.options as string)).toEqual([{ name: "Size", values: ["S", "M"] }, { name: "Colour", values: ["White"] }]);
    expect(f.log).toContain(`${ORIGIN}/robots.txt`);
    expect(f.log).toContain(`${ORIGIN}/meta.json`);
  });

  it("follows pages, and hides products the shop no longer lists", async () => {
    const full = Array.from({ length: 250 }, (_, i) => product({ id: 1000 + i, title: `Item ${i}`, handle: `item-${i}`, variants: [{ price: "10.00", available: true }], options: [] }));
    const { d, id } = setup();
    const f = fake({ pages: [full, [product({ id: 5000, title: "Last Item", handle: "last-item", variants: [{ price: "11.00", available: true }], options: [] })]] });
    const r = await runSource(id, f.deps, d);
    expect(r).toMatchObject({ status: "OK", fetched: 251, created: 251 });
    const second = fake({ pages: [full.slice(0, 249)] });
    const r2 = await runSource(id, second.deps, d);
    expect(r2.status).toBe("OK");
    expect(r2.removed).toBe(2);
    expect((d.prepare("SELECT COUNT(*) AS n FROM products WHERE name = 'Last Item' AND active = 1").get() as { n: number }).n).toBe(0);
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
    const f = fake({ robots: "User-agent: *\nDisallow: /products.json\n" });
    const r = await runSource(id, f.deps, d);
    expect(r.status).toBe("BLOCKED");
    expect(f.log.some((u) => u.includes("products.json"))).toBe(false);
    expect(listImportItems({}, d).total).toBe(0);
  });

  it("stops when the shop refuses with 403", async () => {
    const { d, id } = setup();
    const r = await runSource(id, fake({ robots: 403 }).deps, d);
    expect(r.status).toBe("BLOCKED");
  });

  it("refuses a shop that does not price in pounds", async () => {
    const { d, id } = setup();
    const r = await runSource(id, fake({ currency: "USD" }).deps, d);
    expect(r).toMatchObject({ status: "ERROR", created: 0 });
    expect(r.message).toContain("USD");
  });

  it("explains when the address is not a Shopify shop", async () => {
    const { d, id } = setup();
    const r = await runSource(id, fake({ meta404: true }).deps, d);
    expect(r.status).toBe("ERROR");
    expect(r.message).toContain("does not look like a Shopify shop");
  });

  it("previews without saving anything", async () => {
    const d = openForTest();
    const p = await previewSource({ kind: "shopify", url: ORIGIN, fieldMap: {} }, fake().deps, d);
    expect(p.ok).toBe(true);
    expect(p.sample).toHaveLength(2);
    expect(listImportItems({}, d).total).toBe(0);
  });
});
