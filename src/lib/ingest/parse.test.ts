import { describe, expect, it } from "vitest";
import {
  canonicalUrl, cleanText, cleanUrl, csvToRecords, extractPageProduct, jsonToRecords, mapRecord, parseCsv, parsePrice, parseSitemap, parseStock,
} from "./parse";

describe("parsePrice", () => {
  it("reads common shapes", () => {
    expect(parsePrice("£12.99")).toEqual({ minor: 1299, currency: "GBP" });
    expect(parsePrice("12.99 GBP")).toEqual({ minor: 1299, currency: "GBP" });
    expect(parsePrice("1,299.00")).toEqual({ minor: 129900, currency: null });
    expect(parsePrice("12,99")).toEqual({ minor: 1299, currency: null });
    expect(parsePrice("1.299,00 EUR")).toEqual({ minor: 129900, currency: "EUR" });
    expect(parsePrice("$5")).toEqual({ minor: 500, currency: "USD" });
    expect(parsePrice(19.99)).toEqual({ minor: 1999, currency: null });
  });
  it("ignores ordinary words and rejects junk", () => {
    expect(parsePrice("now 12.99")?.currency).toBeNull();
    for (const bad of ["", "free", "-5", "abc", "99999999999", NaN, null, undefined, {}]) expect(parsePrice(bad as never)).toBeNull();
  });
});

describe("text and url cleaning", () => {
  it("strips tags and decodes entities", () => {
    expect(cleanText("<p>Tea &amp; <b>biscuits</b>&nbsp;&pound;5 &#8364;</p>", 100)).toBe("Tea & biscuits £5 €");
    expect(cleanText("x".repeat(50), 10)).toHaveLength(10);
    expect(cleanText(5, 10)).toBe("");
  });
  it("keeps only http(s) links", () => {
    expect(cleanUrl("https://a.com/x#frag")).toBe("https://a.com/x");
    expect(cleanUrl("/img/a.jpg", "https://a.com/p/1")).toBe("https://a.com/img/a.jpg");
    expect(cleanUrl("javascript:alert(1)")).toBe("");
    expect(cleanUrl("data:text/html,x")).toBe("");
  });
  it("drops tracking parameters for the canonical key", () => {
    expect(canonicalUrl("https://a.com/p/1/?utm_source=x&color=red&gclid=1#top")).toBe("https://a.com/p/1?color=red");
  });
});

describe("CSV", () => {
  it("handles quotes, embedded commas and newlines, CRLF and BOM", () => {
    const csv = '﻿id,name,price\r\n1,"Shoe, red","12.99"\r\n2,"Two\nlines","3.50"\r\n\r\n';
    expect(parseCsv(csv)).toEqual([["id", "name", "price"], ["1", "Shoe, red", "12.99"], ["2", "Two\nlines", "3.50"]]);
    expect(csvToRecords(csv)[1].name).toBe("Two\nlines");
  });
  it("detects tab, semicolon and pipe delimiters", () => {
    expect(parseCsv("a\tb\n1\t2")[1]).toEqual(["1", "2"]);
    expect(parseCsv("a;b\n1;2")[1]).toEqual(["1", "2"]);
    expect(parseCsv("a|b\n1|2")[1]).toEqual(["1", "2"]);
    expect(parseCsv('a,b\n"he said ""hi""",2')[1][0]).toBe('he said "hi"');
  });
});

describe("JSON feeds", () => {
  it("finds the array under common keys", () => {
    expect(jsonToRecords('[{"a":1}]')).toHaveLength(1);
    expect(jsonToRecords('{"products":[{"a":1},{"a":2}]}')).toHaveLength(2);
    expect(jsonToRecords('{"data":{"items":[{"a":1}]}}')).toHaveLength(1);
    expect(jsonToRecords("not json")).toEqual([]);
  });
});

describe("mapRecord", () => {
  it("maps an affiliate-style feed row by alias", () => {
    const r = mapRecord({
      aw_product_id: "A1", product_name: "Cloud Runner", search_price: "64.99", rrp_price: "80.00", currency: "GBP",
      aw_deep_link: "https://track.example/c?x=1", aw_image_url: "https://img.example/a.jpg", brand_name: "Northgate",
      merchant_category: "Shoes > Trainers", in_stock: "1", description: "<p>Light &amp; fast</p>", weight: "0.9kg",
    });
    expect(r).toEqual({
      item: {
        externalId: "A1", productUrl: "https://track.example/c?x=1", name: "Cloud Runner", brand: "Northgate", category: "Trainers",
        description: "Light & fast", priceMinor: 6499, compareAtMinor: 8000, imageUrl: "https://img.example/a.jpg", inStock: true, weightGrams: 900,
      },
    });
  });
  it("honours an explicit field map and nested JSON paths", () => {
    const r = mapRecord({ ref: "Z9", info: { title: "Kettle" }, cost: { gbp: 25 }, link: "https://s.example/k" }, { id: "ref", name: "info.title", price: "cost.gbp" });
    expect("item" in r && r.item).toMatchObject({ externalId: "Z9", name: "Kettle", priceMinor: 2500 });
  });
  it("skips rows it cannot trust", () => {
    expect(mapRecord({ name: "", price: "5" })).toEqual({ skip: "no name" });
    expect(mapRecord({ name: "A", price: "free", id: "1" })).toEqual({ skip: "no valid price" });
    expect(mapRecord({ name: "A", price: "0", id: "1" })).toEqual({ skip: "no valid price" });
    expect(mapRecord({ name: "A", price: "5", id: "1", currency: "EUR" })).toEqual({ skip: "price is in EUR, not GBP" });
    expect(mapRecord({ name: "A", price: "$5", id: "1" })).toEqual({ skip: "price is in USD, not GBP" });
    expect(mapRecord({ name: "A", price: "5" })).toEqual({ skip: "no id or link" });
  });
  it("ignores a was-price that is not higher, and unsafe image links", () => {
    const r = mapRecord({ id: "1", name: "A", price: "10", rrp: "9", image_url: "javascript:x" });
    expect("item" in r && r.item.compareAtMinor).toBeNull();
    expect("item" in r && r.item.imageUrl).toBe("");
  });
  it("reads stock flags", () => {
    expect(parseStock("out of stock")).toBe(false);
    expect(parseStock("https://schema.org/OutOfStock")).toBe(false);
    expect(parseStock("OutOfStock")).toBe(false);
    expect(parseStock("0")).toBe(false);
    expect(parseStock(0)).toBe(false);
    expect(parseStock("in stock")).toBe(true);
    expect(parseStock("InStock")).toBe(true);
    expect(parseStock("")).toBe(true);
    expect(parseStock("12")).toBe(true);
  });
});

describe("sitemaps", () => {
  it("separates page lists from indexes and decodes entities", () => {
    expect(parseSitemap('<urlset><url><loc>https://a.com/p?a=1&amp;b=2</loc></url><url><loc> https://a.com/q </loc></url></urlset>')).toEqual({
      urls: ["https://a.com/p?a=1&b=2", "https://a.com/q"], sitemaps: [],
    });
    expect(parseSitemap("<sitemapindex><sitemap><loc>https://a.com/s1.xml</loc></sitemap></sitemapindex>")).toEqual({ urls: [], sitemaps: ["https://a.com/s1.xml"] });
  });
});

const ld = (obj: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head></html>`;

describe("product pages", () => {
  it("reads a JSON-LD Product with an Offer", () => {
    const r = extractPageProduct(
      ld({ "@context": "https://schema.org", "@type": "Product", name: "Teapot", brand: { "@type": "Brand", name: "Brew" }, image: ["/t.jpg"], sku: "T1", description: "<b>Nice</b> pot",
        offers: { "@type": "Offer", price: "18.50", priceCurrency: "GBP", availability: "https://schema.org/InStock" } }),
      "https://shop.example/teapot?utm_source=x",
    );
    expect(r).toEqual({
      item: { externalId: "https://shop.example/teapot", productUrl: "https://shop.example/teapot?utm_source=x", name: "Teapot", brand: "Brew", category: "", description: "Nice pot",
        priceMinor: 1850, compareAtMinor: null, imageUrl: "https://shop.example/t.jpg", inStock: true, weightGrams: null },
    });
  });
  it("finds the product inside @graph and takes the lowest GBP offer, with a list price", () => {
    const r = extractPageProduct(
      ld({ "@graph": [{ "@type": "WebSite" }, { "@type": ["Product", "Thing"], name: "Lamp", offers: [
        { price: 30, priceCurrency: "GBP", availability: "OutOfStock" },
        { price: 25, priceCurrency: "GBP", availability: "InStock", priceSpecification: [{ priceType: "https://schema.org/ListPrice", price: 40 }, { price: 25 }] },
      ] }] }),
      "https://shop.example/lamp",
    );
    expect("item" in r && r.item).toMatchObject({ priceMinor: 2500, compareAtMinor: 4000, inStock: true });
  });
  it("handles an AggregateOffer and a weight", () => {
    const r = extractPageProduct(ld({ "@type": "Product", name: "Mug", weight: { value: 0.4, unitCode: "KGM" }, offers: { "@type": "AggregateOffer", lowPrice: "4.00", highPrice: "6.00", priceCurrency: "GBP" } }), "https://s.example/m");
    expect("item" in r && r.item).toMatchObject({ priceMinor: 400, weightGrams: 400 });
  });
  it("skips non-GBP pages, pages without prices and pages without data", () => {
    expect(extractPageProduct(ld({ "@type": "Product", name: "X", offers: { price: 5, priceCurrency: "USD" } }), "https://s.example/x")).toEqual({ skip: "price is in USD, not GBP" });
    expect(extractPageProduct(ld({ "@type": "Product", name: "X" }), "https://s.example/x")).toEqual({ skip: "no price on the page" });
    expect(extractPageProduct("<html><body>hello</body></html>", "https://s.example/x")).toEqual({ skip: "no product data on the page" });
  });
  it("survives broken JSON-LD blocks and falls back to Open Graph", () => {
    const html = `<script type="application/ld+json">{ broken</script>
      <meta property="og:title" content="Rug &amp; Mat"><meta property="product:price:amount" content="45.00">
      <meta property="product:price:currency" content="GBP"><meta property="og:image" content="/r.jpg">`;
    const r = extractPageProduct(html, "https://s.example/rug");
    expect("item" in r && r.item).toMatchObject({ name: "Rug & Mat", priceMinor: 4500, imageUrl: "https://s.example/r.jpg" });
  });
});
