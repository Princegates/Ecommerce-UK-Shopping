import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import {
  DEFAULT_AUTO, autoQuoteRequest, decideAutoQuote, getItemTypes, getLinkAuto, itemTypesToText, parseItemTypes, saveItemTypes, saveLinkAuto, weightForType,
} from "./link-auto";
import { getLinkRequest, placeLinkOrder } from "./link-orders";
import { getShippingMethods, getZones } from "./settings";

const NOW = Date.parse("2026-10-07T12:00:00Z");
const on = { ...DEFAULT_AUTO, customerEnabled: true };

describe("deciding an automatic quote", () => {
  it("uses the price read from the shop page as it is", () => {
    expect(decideAutoQuote(DEFAULT_AUTO, { pagePriceMinor: 2499, customerPriceMinor: 1000 })).toEqual({ quote: true, source: "page", unitPriceMinor: 2499, basisMinor: 2499 });
  });

  it("does not trust a customer-typed price unless that is switched on, then adds the margin", () => {
    expect(decideAutoQuote(DEFAULT_AUTO, { pagePriceMinor: null, customerPriceMinor: 2000 })).toMatchObject({ quote: false });
    expect(decideAutoQuote(on, { pagePriceMinor: null, customerPriceMinor: 2000 })).toEqual({ quote: true, source: "customer", unitPriceMinor: 2100, basisMinor: 2000 });
    expect(decideAutoQuote({ ...on, marginPct: 10 }, { pagePriceMinor: null, customerPriceMinor: 3000 })).toMatchObject({ unitPriceMinor: 3300 });
    expect(decideAutoQuote({ ...on, marginPct: 7.5 }, { pagePriceMinor: null, customerPriceMinor: 1000 })).toMatchObject({ unitPriceMinor: 1075 });
    expect(decideAutoQuote({ ...on, marginPct: 0 }, { pagePriceMinor: null, customerPriceMinor: 2000 })).toMatchObject({ unitPriceMinor: 2000 });
  });

  it("prefers the page price over what the customer typed", () => {
    expect(decideAutoQuote(on, { pagePriceMinor: 3000, customerPriceMinor: 100 })).toMatchObject({ source: "page", unitPriceMinor: 3000 });
  });

  it("hands dear, tiny or missing prices to a person", () => {
    expect(decideAutoQuote(DEFAULT_AUTO, { pagePriceMinor: 20_000, customerPriceMinor: null })).toEqual({ quote: false, reason: "above the automatic limit" });
    expect(decideAutoQuote(on, { pagePriceMinor: null, customerPriceMinor: 14_500 })).toMatchObject({ quote: false }); // 14,500 + 5% is over the £150 limit
    expect(decideAutoQuote(on, { pagePriceMinor: null, customerPriceMinor: 10 })).toMatchObject({ quote: false });
    expect(decideAutoQuote(on, { pagePriceMinor: null, customerPriceMinor: null })).toMatchObject({ quote: false });
    expect(decideAutoQuote({ ...DEFAULT_AUTO, pageEnabled: false }, { pagePriceMinor: 2000, customerPriceMinor: null })).toMatchObject({ quote: false });
  });
});

describe("settings", () => {
  it("starts safe, saves, and keeps values in range", () => {
    const d = openForTest();
    expect(getLinkAuto(d)).toEqual({ pageEnabled: true, customerEnabled: false, marginPct: 5, ceilingMinor: 15_000, validDays: 3 });
    saveLinkAuto({ customerEnabled: true, marginPct: 999, ceilingMinor: 1, validDays: 0 }, d);
    expect(getLinkAuto(d)).toMatchObject({ customerEnabled: true, marginPct: 50, ceilingMinor: 1000, validDays: 1 });
  });

  it("reads and writes item types with their weights", () => {
    const d = openForTest();
    expect(getItemTypes(d).length).toBeGreaterThan(3);
    const parsed = parseItemTypes("Shoes: 1200\nHeavy gear = 4500 g\n\nOther or not sure, 900");
    expect(parsed).toEqual({ ok: true, value: [{ name: "Shoes", grams: 1200 }, { name: "Heavy gear", grams: 4500 }, { name: "Other or not sure", grams: 900 }] });
    if (!parsed.ok) return;
    saveItemTypes(parsed.value, d);
    expect(itemTypesToText(getItemTypes(d))).toBe("Shoes: 1200\nHeavy gear: 4500\nOther or not sure: 900");
    expect(weightForType("Heavy gear", d)).toBe(4500);
    expect(weightForType("", d)).toBe(900); // falls back to the catch-all
    expect(parseItemTypes("Shoes").ok).toBe(false);
    expect(parseItemTypes("A: 0").ok).toBe(false);
    expect(parseItemTypes("Shoes: 10\nshoes: 20").ok).toBe(false);
    expect(parseItemTypes("   ").ok).toBe(false);
  });
});

describe("quoting a request by itself", () => {
  function setup(priceSeen = "20.00", itemType = "Shoes and boots") {
    const d = openForTest();
    d.prepare("INSERT INTO customers (id, name, phone, password_hash) VALUES (5, 'Ama', '0241234567', 'x')").run();
    const id = Number(d.prepare("INSERT INTO link_requests (url, title, quantity, price_seen, name, phone, customer_id, item_type) VALUES ('https://www.argos.co.uk/p/1', 'Boots', 1, ?, 'Ama', '0241234567', 5, ?)").run(priceSeen, itemType).lastInsertRowid);
    return { d, id };
  }

  it("prices from the page, sets the weight from the item type, and the customer can then order", () => {
    const { d, id } = setup();
    const r = autoQuoteRequest(id, 4999, d, NOW);
    expect(r).toMatchObject({ quoted: true, source: "page", unitPriceMinor: 4999 });
    expect(getLinkRequest(id, d)).toMatchObject({ status: "QUOTED", quotePriceMinor: 4999, quoteWeightGrams: 1200, quoteSource: "page", quoteBasisMinor: 4999 });
    const token = r.quoted ? r.token : "";
    const order = placeLinkOrder(token, { customerName: "Ama", phone: "0241234567", email: "", zoneId: getZones(true, d)[0].id, address: "12 Example Street", landmark: "", notes: "", shippingCode: getShippingMethods(true, d)[0].code, customerId: 5 }, d, NOW);
    expect(order).toMatchObject({ ok: true });
  });

  it("uses the customer's price plus margin only when allowed, and says so in the note", () => {
    const { d, id } = setup("20.00");
    expect(autoQuoteRequest(id, null, d, NOW)).toMatchObject({ quoted: false });
    expect(getLinkRequest(id, d)?.status).toBe("NEW");
    saveLinkAuto({ customerEnabled: true, marginPct: 10 }, d);
    expect(autoQuoteRequest(id, null, d, NOW)).toMatchObject({ quoted: true, source: "customer", unitPriceMinor: 2200 });
    const q = getLinkRequest(id, d)!;
    expect(q).toMatchObject({ quoteSource: "customer", quoteBasisMinor: 2000 });
    expect(q.quoteNote).toContain("10% safety margin");
  });

  it("leaves a dear item for a person", () => {
    const { d, id } = setup("400.00");
    saveLinkAuto({ customerEnabled: true }, d);
    expect(autoQuoteRequest(id, 40_000, d, NOW)).toEqual({ quoted: false, reason: "above the automatic limit" });
    expect(getLinkRequest(id, d)?.status).toBe("NEW");
  });

  it("does not touch a request that was already ordered", () => {
    const { d, id } = setup();
    d.prepare("UPDATE link_requests SET status = 'ORDERED', order_id = 99 WHERE id = ?").run(id);
    expect(autoQuoteRequest(id, 2000, d, NOW)).toMatchObject({ quoted: false });
  });
});
