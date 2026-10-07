import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import {
  dealPercent, dealProducts, departmentFromSlug, isDealLive, listDepartments, listProducts, newArrivals, productsByIds, queryProducts,
} from "./catalog";
import type { CartLine } from "./cart";
import { registerCustomer } from "./customers";
import { buildDeliveryContext, landedMinor } from "./landed";
import { createOrder, staffSetStatus, markPaid } from "./orders";
import { addReview, adminReviews, displayName, listReviews, ratingSummary, reviewEligibility, setReviewStatus } from "./reviews";
import { getProductById } from "./catalog";
import { getShippingMethods, getZones } from "./settings";

describe("deals", () => {
  it("is live only with a higher was-price that has not expired", () => {
    const base = { priceMinor: 8000, compareAtMinor: 10000, dealEndsAt: null as string | null };
    expect(isDealLive(base)).toBe(true);
    expect(isDealLive({ ...base, compareAtMinor: 8000 })).toBe(false);
    expect(isDealLive({ ...base, compareAtMinor: null })).toBe(false);
    expect(isDealLive({ ...base, dealEndsAt: "2020-01-01 00:00:00" })).toBe(false);
    expect(isDealLive({ ...base, dealEndsAt: "2099-01-01 00:00:00" })).toBe(true);
    expect(dealPercent(base)).toBe(20);
    expect(dealPercent({ priceMinor: 100, compareAtMinor: null })).toBe(0);
  });
  it("lists live deals best first and drops expired ones", () => {
    const d = openForTest();
    expect(dealProducts(20, d).length).toBe(9); // the seed ships sample deals
    d.prepare("UPDATE products SET compare_at_minor = NULL, deal_ends_at = NULL").run();
    const [a, b, c] = listProducts({}, d);
    d.prepare("UPDATE products SET compare_at_minor = price_minor * 2 WHERE id = ?").run(a.id); // 50% off
    d.prepare("UPDATE products SET compare_at_minor = price_minor * 1.25 WHERE id = ?").run(b.id); // 20% off
    d.prepare("UPDATE products SET compare_at_minor = price_minor * 3, deal_ends_at = datetime('now', '-1 hour') WHERE id = ?").run(c.id);
    expect(dealProducts(10, d).map((p) => p.id)).toEqual([a.id, b.id]);
  });
});

describe("search and filters", () => {
  it("filters by shop, department, category and price, and sorts", () => {
    const d = openForTest();
    const all = queryProducts({ limit: 100 }, d);
    expect(all.total).toBe(40);
    const fashion = queryProducts({ departments: ["Fashion"], limit: 100 }, d);
    expect(fashion.total).toBe(5);
    expect(fashion.items.every((p) => p.shopCategory === "Fashion")).toBe(true);
    const trainers = queryProducts({ q: "trainers", limit: 100 }, d);
    expect(trainers.items.length).toBeGreaterThan(0);
    expect(trainers.items.every((p) => /trainer/i.test(`${p.name} ${p.category} ${p.brand} ${p.shopName}`))).toBe(true);
    const cheap = queryProducts({ maxGbpMinor: 2000, sort: "price-asc", limit: 100 }, d);
    expect(cheap.items.every((p) => p.priceMinor <= 2000)).toBe(true);
    expect(cheap.items.map((p) => p.priceMinor)).toEqual([...cheap.items.map((p) => p.priceMinor)].sort((x, y) => x - y));
    const band = queryProducts({ minGbpMinor: 5000, maxGbpMinor: 7000, limit: 100 }, d);
    expect(band.items.every((p) => p.priceMinor >= 5000 && p.priceMinor <= 7000)).toBe(true);
    const shop = queryProducts({ shopSlugs: [all.facets.shops[0].slug], limit: 100 }, d);
    expect(shop.items.every((p) => p.shopSlug === all.facets.shops[0].slug)).toBe(true);
  });
  it("paginates and caps the page size", () => {
    const d = openForTest();
    const p1 = queryProducts({ limit: 10, offset: 0 }, d);
    const p2 = queryProducts({ limit: 10, offset: 10 }, d);
    expect(p1.items).toHaveLength(10);
    expect(p1.items[0].id).not.toBe(p2.items[0].id);
    expect(queryProducts({ limit: 5000 }, d).items.length).toBeLessThanOrEqual(100);
  });
  it("facet counts ignore their own filter so a choice can be widened", () => {
    const d = openForTest();
    const f = queryProducts({ departments: ["Fashion"], limit: 1 }, d).facets;
    expect(f.departments.length).toBeGreaterThan(1);
    expect(f.shops).toHaveLength(1);
    expect(f.departments.find((x) => x.name === "Fashion")?.count).toBe(5);
    expect(f.priceMaxGbp).toBeGreaterThanOrEqual(f.priceMinGbp);
  });
  it("treats search text as text, not SQL", () => {
    const d = openForTest();
    expect(queryProducts({ q: "x' OR '1'='1", limit: 5 }, d).total).toBe(0);
    expect(queryProducts({ q: "%", limit: 5 }, d).total).toBe(0);
    expect(queryProducts({ shopSlugs: ["a'; DROP TABLE products;--"] }, d).total).toBe(0);
    expect(queryProducts({ limit: 1 }, d).total).toBe(40);
  });
  it("hides products from inactive shops and lists newest, by-ids and departments", () => {
    const d = openForTest();
    const first = listProducts({}, d)[0];
    d.prepare("UPDATE shops SET active = 0 WHERE id = ?").run(first.shopId);
    expect(queryProducts({ limit: 100 }, d).total).toBe(35);
    expect(productsByIds([first.id, 999999], d)).toEqual([]);
    expect(newArrivals(3, d)).toHaveLength(3);
    const deps = listDepartments(d);
    expect(deps.length).toBe(7);
    expect(deps.every((x) => x.products === 5)).toBe(true);
    expect(departmentFromSlug("home-and-furniture", d)?.name).toBe("Home & Furniture");
    expect(departmentFromSlug("nope", d)).toBeNull();
  });
});

async function deliveredBuyer() {
  const d = openForTest();
  const c = await registerCustomer({ name: "Ama Mensah", phone: "0241234567", email: "", password: "river-lamp-orange-42" }, d);
  if (!c.ok) throw new Error("setup");
  const product = listProducts({}, d)[0];
  const line: CartLine = { itemId: 1, product: getProductById(product.id, d)!, quantity: 1, options: Object.fromEntries(product.options.map((g) => [g.name, g.values[0]])) };
  const r = createOrder([line], {
    customerName: "Ama Mensah", phone: "0241234567", email: "", zoneId: getZones(true, d)[0].id, address: "12 Example Street",
    landmark: "", notes: "", shippingCode: getShippingMethods(true, d)[0].code, customerId: c.customer.id,
  }, d);
  if (!r.ok) throw new Error(r.error);
  const id = (d.prepare("SELECT id FROM orders WHERE payment_ref = ?").get(r.paymentRef) as { id: number }).id;
  return { d, customer: c.customer, product, id, ref: r.paymentRef };
}

describe("reviews", () => {
  it("lets only buyers whose order was delivered review, once", async () => {
    const { d, customer, product, id, ref } = await deliveredBuyer();
    expect(reviewEligibility(customer.id, product.id, d)).toBe("not-purchased");
    markPaid(ref, d);
    for (const s of ["PURCHASING", "PURCHASED", "AT_UK_WAREHOUSE", "SHIPPED_TO_GHANA", "IN_CUSTOMS", "OUT_FOR_DELIVERY"] as const) staffSetStatus(id, s, "", d);
    expect(reviewEligibility(customer.id, product.id, d)).toBe("not-purchased");
    staffSetStatus(id, "DELIVERED", "", d);
    expect(reviewEligibility(customer.id, product.id, d)).toBe("yes");
    expect(addReview(customer.id, customer.name, product.id, { rating: 6, title: "x", body: "" }, d).ok).toBe(false);
    expect(addReview(customer.id, customer.name, product.id, { rating: 5, title: "", body: "hi" }, d).ok).toBe(false);
    expect(addReview(customer.id, customer.name, product.id, { rating: 5, title: "Great trainers", body: "Fit perfectly and arrived well packed." }, d).ok).toBe(true);
    expect(reviewEligibility(customer.id, product.id, d)).toBe("already");
    expect(addReview(customer.id, customer.name, product.id, { rating: 1, title: "again", body: "second try here" }, d).ok).toBe(false);
  });
  it("summarises ratings, shows a short name, and lets admins hide a review", async () => {
    const { d, customer, product, id, ref } = await deliveredBuyer();
    markPaid(ref, d);
    d.prepare("UPDATE orders SET status = 'DELIVERED' WHERE id = ?").run(id);
    addReview(customer.id, customer.name, product.id, { rating: 4, title: "Good", body: "Does the job well." }, d);
    expect(listReviews(product.id, 10, d)[0]).toMatchObject({ author: "Ama M.", rating: 4 });
    expect(ratingSummary(product.id, d)).toMatchObject({ average: 4, count: 1 });
    expect(getProductById(product.id, d)).toMatchObject({ reviewCount: 1, ratingAvg: 4 });
    const rid = adminReviews(undefined, d)[0].id;
    expect(setReviewStatus(rid, "HIDDEN", d)).toBe(true);
    expect(listReviews(product.id, 10, d)).toHaveLength(0);
    expect(ratingSummary(product.id, d).average).toBeNull();
    expect(adminReviews("HIDDEN", d)).toHaveLength(1);
    expect(displayName("Kofi")).toBe("Kofi");
    expect(displayName("Kwame Nkrumah Boateng")).toBe("Kwame B.");
  });
});

describe("landed cost previews", () => {
  it("prices one item to the door and respects the chosen area", () => {
    const d = openForTest();
    const p = listProducts({}, d)[0];
    const first = buildDeliveryContext(null, d)!;
    const zones = getZones(true, d);
    const far = buildDeliveryContext(zones[zones.length - 1].id, d)!;
    expect(first.zoneId).toBe(zones[0].id);
    expect(landedMinor(p, far) - landedMinor(p, first)).toBe(zones[zones.length - 1].feeMinor - zones[0].feeMinor);
    expect(landedMinor(p, first, 2)).toBeGreaterThan(landedMinor(p, first));
    expect(buildDeliveryContext(99999, d)?.zoneId).toBe(zones[0].id);
  });
});
