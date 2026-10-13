import { describe, expect, it } from "vitest";
import { dutyCategoryForItemType, inferDutyCategory } from "./duty-category";
import { DEFAULT_PRICING_CONFIG } from "./quote-engine";

describe("duty category from the name", () => {
  const cases: [string, string][] = [
    ["Orbit 6 Smartphone, 128GB", "phones_tablets"],
    ["Pulse Wireless Earbuds", "audio_wearables"],
    ["Cloud Runner Trainers", "footwear"],
    ["Trail Running Shoes", "footwear"],
    ["Padded Winter Jacket", "clothing_apparel"],
    ["Digital Air Fryer, 5L", "kitchen_home"],
    ["Pro Match Football, size 5", "sports_outdoor"],
    ["18V Cordless Drill Driver Kit", "kitchen_home"],
    ["Baby Starter Bundle, 0-3 months", "baby_kids_toys"],
    ["The Pocket Atlas, hardback book", "books_stationery"],
    ["Laptop 15 inch", "laptops_computers"],
    ["Wireless Keyboard and Mouse", "computer_accessories"],
    ["Leather Backpack", "bags_luggage"],
    ["Eau de Parfum perfume 50ml", "beauty_personal_care"],
    ["Dog lead and collar", "pets"],
  ];
  for (const [name, id] of cases) it(`${name} is ${id}`, () => expect(inferDutyCategory(name)).toBe(id));
  it("uses the category text as well as the name", () => {
    expect(inferDutyCategory("Mystery item", "Garden")).toBe("kitchen_home");
  });
  it("calls an unrecognised item unknown, and every id it can return exists in the configuration", () => {
    expect(inferDutyCategory("Zorblax 3000")).toBe("unknown");
    const ids = new Set(DEFAULT_PRICING_CONFIG.categories.map((c) => c.id));
    for (const [, id] of cases) expect(ids.has(id)).toBe(true);
    for (const t of ["Clothing", "Shoes and boots", "Beauty and health", "Small electronics", "Home and kitchen", "Toys and baby", "Books", "Sports and outdoors", "Other or not sure"]) {
      expect(ids.has(dutyCategoryForItemType(t))).toBe(true);
    }
  });
});
