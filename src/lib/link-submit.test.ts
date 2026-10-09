import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import { saveLinkAuto } from "./link-auto";
import { getLinkRequest } from "./link-orders";
import { submitLinkRequest, type LinkRequestInput } from "./link-submit";

const NOW = Date.parse("2026-10-07T12:00:00Z");
const input = (over: Partial<LinkRequestInput> = {}): LinkRequestInput => ({
  url: "https://www.next.co.uk/style/su1/a", title: "Linen Shirt", details: "M, white", quantity: 2, priceSeen: "", itemType: "Clothing", name: "Ama", phone: "0241234567", email: "", ...over,
});

function setup() {
  const d = openForTest();
  d.prepare("INSERT INTO customers (id, name, phone, password_hash) VALUES (5, 'Ama', '0241234567', 'x')").run();
  return d;
}

describe("submitting a link request", () => {
  it("uses the price the system read from the page, with no price typed by the customer", async () => {
    const d = setup();
    const out = await submitLinkRequest(input(), 5, async () => 3500, d, NOW);
    expect(out.quote).toMatchObject({ source: "page", unitPriceMinor: 3500 });
    expect(getLinkRequest(out.id, d)).toMatchObject({ status: "QUOTED", priceSeen: "35.00", quotePriceMinor: 3500, quoteWeightGrams: 500, customerId: 5, itemType: "Clothing", quantity: 2 });
  });

  it("falls back to a person when the page cannot be read, even if the page reader throws", async () => {
    const d = setup();
    const none = await submitLinkRequest(input(), 5, async () => null, d, NOW);
    expect(none.quote).toBeUndefined();
    expect(getLinkRequest(none.id, d)?.status).toBe("NEW");
    const boom = await submitLinkRequest(input({ url: "https://shop.example/b" }), null, async () => { throw new Error("network down"); }, d, NOW);
    expect(boom.quote).toBeUndefined();
    expect(getLinkRequest(boom.id, d)).toMatchObject({ status: "NEW", customerId: null });
  });

  it("does not read the page at all when that automatic quote is switched off", async () => {
    const d = setup();
    saveLinkAuto({ pageEnabled: false }, d);
    let reads = 0;
    const out = await submitLinkRequest(input(), 5, async () => { reads++; return 3500; }, d, NOW);
    expect(reads).toBe(0);
    expect(out.quote).toBeUndefined();
  });

  it("ignores an item type that is not on the list, and leaves a dear page price for a person", async () => {
    const d = setup();
    const odd = await submitLinkRequest(input({ itemType: "Made up" }), 5, async () => 2000, d, NOW);
    expect(getLinkRequest(odd.id, d)?.itemType).toBe("");
    const dear = await submitLinkRequest(input({ url: "https://shop.example/tv" }), 5, async () => 90_000, d, NOW);
    expect(dear.quote).toBeUndefined();
    expect(getLinkRequest(dear.id, d)?.status).toBe("NEW");
  });

  it("accepts an item described in words, with no link, and leaves it for a person", async () => {
    const d = setup();
    let reads = 0;
    const out = await submitLinkRequest(input({ url: "", title: "OnePlus 13 256GB", priceSeen: "700" }), 5, async () => { reads++; return 70000; }, d, NOW);
    expect(out.quote).toBeUndefined();
    expect(reads).toBe(0);
    expect(getLinkRequest(out.id, d)).toMatchObject({ status: "NEW", url: "", title: "OnePlus 13 256GB" });
  });
});
