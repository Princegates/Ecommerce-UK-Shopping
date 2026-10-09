import { describe, expect, it } from "vitest";
import { extractFirstUrl, normalizeRequestUrl, parseAmazonLink, wrongStoreMessage } from "./amazon-links";

describe("parseAmazonLink", () => {
  it("reads the product number from the usual Amazon UK address shapes", () => {
    for (const u of [
      "https://www.amazon.co.uk/dp/B0FXFR45J7",
      "https://www.amazon.co.uk/OnePlus-Dual-SIM-Unlocked/dp/B0FXFR45J7/ref=sr_1_1?dib=abc&qid=1&sr=8-1",
      "https://amazon.co.uk/gp/product/B0FXFR45J7?th=1&psc=1",
      "https://www.amazon.co.uk/gp/aw/d/B0FXFR45J7",
      "https://m.amazon.co.uk/dp/B0FXFR45J7#reviews",
      "http://smile.amazon.co.uk/Some-Title/dp/B0FXFR45J7",
    ]) {
      expect(parseAmazonLink(u)).toEqual({ asin: "B0FXFR45J7", store: "uk", host: u.includes("m.amazon") ? "amazon.co.uk" : "amazon.co.uk", ukUrl: "https://www.amazon.co.uk/dp/B0FXFR45J7" });
    }
  });

  it("tells the US store and other countries apart, and builds the UK address for the same product", () => {
    expect(parseAmazonLink("https://www.amazon.com/OnePlus/dp/B0FXFR45J7/ref=sr_1_1")).toMatchObject({ store: "us", asin: "B0FXFR45J7", ukUrl: "https://www.amazon.co.uk/dp/B0FXFR45J7" });
    expect(parseAmazonLink("https://www.amazon.de/dp/B0FXFR45J7")).toMatchObject({ store: "other" });
  });

  it("recognises the short links the Amazon app shares, without being able to read a product number from them", () => {
    for (const u of ["https://a.co/d/0abcDEF", "https://amzn.to/3xYz", "https://amzn.eu/d/abc123"]) expect(parseAmazonLink(u)).toMatchObject({ store: "short", asin: null, ukUrl: null });
  });

  it("ignores what is not Amazon: other shops, look-alike addresses, and things that are not addresses", () => {
    expect(parseAmazonLink("https://www.argos.co.uk/product/123")).toBeNull();
    expect(parseAmazonLink("https://amazon.co.uk.evil.example/dp/B0FXFR45J7")).toBeNull();
    expect(parseAmazonLink("https://notamazon.co.uk/dp/B0FXFR45J7")).toBeNull();
    expect(parseAmazonLink("javascript:alert(1)")).toBeNull();
    expect(parseAmazonLink("not a link")).toBeNull();
  });

  it("does not take a product number from somewhere other than the path", () => {
    expect(parseAmazonLink("https://www.amazon.co.uk/s?k=B0FXFR45J7")).toMatchObject({ asin: null });
    expect(parseAmazonLink("https://www.amazon.co.uk/dp/short")).toMatchObject({ asin: null });
    expect(parseAmazonLink("https://www.amazon.co.uk/dp/b0fxfr45j7")).toMatchObject({ asin: null });
  });
});

describe("extractFirstUrl", () => {
  it("pulls the address out of text shared from the Amazon app", () => {
    expect(extractFirstUrl("Check out OnePlus 15R! https://a.co/d/0abcDEF")).toBe("https://a.co/d/0abcDEF");
    expect(extractFirstUrl("see (https://www.amazon.co.uk/dp/B0FXFR45J7), thanks.")).toBe("https://www.amazon.co.uk/dp/B0FXFR45J7");
    expect(extractFirstUrl("https://a.co/d/x.")).toBe("https://a.co/d/x");
    expect(extractFirstUrl("no link here")).toBe("");
  });
});

describe("normalizeRequestUrl", () => {
  it("cleans an Amazon UK address down to the plain product page, dropping tracking and seller parameters", () => {
    const messy = "https://www.amazon.co.uk/OnePlus-15R/dp/B0FXFR45J7/ref=sr_1_1_sspa?dib=eyJ&qid=1791520634&sr=8-1-spons&sp_csd=abc&psc=1&smid=A3P5ROKL5A1OLE&tag=someone-21";
    expect(normalizeRequestUrl(messy)).toMatchObject({ url: "https://www.amazon.co.uk/dp/B0FXFR45J7", amazon: { store: "uk" } });
  });

  it("finds the address inside shared text", () => {
    expect(normalizeRequestUrl("Look at this: https://www.amazon.co.uk/dp/B0FXFR45J7?th=1 great price").url).toBe("https://www.amazon.co.uk/dp/B0FXFR45J7");
  });

  it("leaves every other address exactly as it was", () => {
    expect(normalizeRequestUrl("https://www.argos.co.uk/product/123?x=1")).toEqual({ url: "https://www.argos.co.uk/product/123?x=1", amazon: null });
    expect(normalizeRequestUrl("https://www.amazon.com/dp/B0FXFR45J7?th=1")).toMatchObject({ url: "https://www.amazon.com/dp/B0FXFR45J7?th=1", amazon: { store: "us" } });
    expect(normalizeRequestUrl("https://a.co/d/0abcDEF")).toMatchObject({ url: "https://a.co/d/0abcDEF", amazon: { store: "short" } });
  });
});

describe("wrongStoreMessage", () => {
  it("points the customer to the same product on Amazon UK", () => {
    expect(wrongStoreMessage(parseAmazonLink("https://www.amazon.com/dp/B0FXFR45J7")!)).toContain("https://www.amazon.co.uk/dp/B0FXFR45J7");
    expect(wrongStoreMessage({ asin: null, store: "other", host: "amazon.de", ukUrl: null })).toContain("amazon.co.uk");
  });
});
