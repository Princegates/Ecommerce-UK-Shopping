import type Database from "better-sqlite3";
import { slugify } from "./slug";
import type { RateCard, ServiceFeeRule } from "./pricing";

/**
 * Sample data so the site is usable on first run. Every shop and product here
 * is fictional: real retailers need a terms assessment before they are listed,
 * and their names, logos and photos are not ours to use. Replace this data from
 * the admin area.
 */

type SeedShop = {
  name: string;
  tagline: string;
  category: string;
  accent: string;
  description: string;
};

const SHOPS: SeedShop[] = [
  { name: "Northgate Fashion", tagline: "High-street clothes and trainers", category: "Fashion", accent: "#c8321f", description: "Everyday menswear, womenswear and trainers from a Manchester-style high-street chain (sample shop)." },
  { name: "Brightwire Electronics", tagline: "Phones, audio and laptops", category: "Electronics", accent: "#1f4e79", description: "Consumer electronics with UK warranty cards (sample shop)." },
  { name: "Hearth & Home", tagline: "Kitchen, bedding and furniture", category: "Home & Furniture", accent: "#7a3b1d", description: "Homeware for kitchens, bedrooms and living rooms (sample shop)." },
  { name: "Petal & Pine", tagline: "Skincare, beauty and wellbeing", category: "Beauty & Health", accent: "#b5527a", description: "Skincare, hair care and wellbeing basics (sample shop)." },
  { name: "Fieldmark Sports", tagline: "Football, running and gym kit", category: "Sports", accent: "#0b5d3b", description: "Sportswear and equipment for football, running and the gym (sample shop)." },
  { name: "Little Acorn", tagline: "Baby and kids essentials", category: "Baby & Kids", accent: "#e0a100", description: "Clothing, toys and nursery items for children up to ten (sample shop)." },
  { name: "Quill & Page", tagline: "Books and stationery", category: "Books", accent: "#2a6f6b", description: "Textbooks, novels and stationery (sample shop)." },
  { name: "Torque Tools", tagline: "Power tools and car care", category: "Tools & Auto", accent: "#3f4a2b", description: "Hand tools, power tools and car-care supplies (sample shop)." },
];

const SIZES_SHOE = { name: "Size", values: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"] };
const SIZES_CLOTH = { name: "Size", values: ["S", "M", "L", "XL"] };

type SeedProduct = [
  shop: string, name: string, brand: string, category: string,
  pricePounds: number, grams: number, options: { name: string; values: string[] }[], description: string,
];

const PRODUCTS: SeedProduct[] = [
  ["Northgate Fashion", "Cloud Runner Trainers", "Northgate", "Trainers", 64.99, 900, [SIZES_SHOE, { name: "Colour", values: ["Black", "White", "Red"] }], "Cushioned everyday trainers with a mesh upper and a grippy rubber sole."],
  ["Northgate Fashion", "Slim Fit Stretch Jeans", "Northgate", "Jeans", 34.0, 700, [{ name: "Waist", values: ["30", "32", "34", "36"] }, { name: "Colour", values: ["Indigo", "Black"] }], "Mid-rise slim jeans in stretch denim."],
  ["Northgate Fashion", "Padded Winter Jacket", "Northgate", "Coats", 89.5, 1400, [SIZES_CLOTH, { name: "Colour", values: ["Navy", "Olive"] }], "Water-resistant padded jacket with a detachable hood."],
  ["Northgate Fashion", "Crew Neck Sweatshirt", "Northgate", "Tops", 22.0, 550, [SIZES_CLOTH, { name: "Colour", values: ["Grey", "Black", "Cream"] }], "Soft brushed-back cotton sweatshirt."],
  ["Northgate Fashion", "Leather Weekender Bag", "Northgate", "Bags", 79.0, 1600, [{ name: "Colour", values: ["Tan", "Black"] }], "Full-grain leather holdall with a zipped shoe compartment."],

  ["Brightwire Electronics", "Pulse Wireless Earbuds", "Brightwire", "Audio", 49.99, 180, [{ name: "Colour", values: ["Black", "White"] }], "Bluetooth earbuds with noise reduction and a 24-hour charging case."],
  ["Brightwire Electronics", "Nova 14 Laptop, 16GB / 512GB", "Brightwire", "Laptops", 549.0, 1600, [{ name: "Colour", values: ["Silver", "Graphite"] }], "14-inch laptop for study and office work. UK keyboard layout."],
  ["Brightwire Electronics", "Orbit 6 Smartphone, 128GB", "Brightwire", "Phones", 229.0, 350, [{ name: "Colour", values: ["Midnight", "Sky"] }], "6.5-inch phone with dual SIM and a 5,000 mAh battery. Unlocked."],
  ["Brightwire Electronics", "20,000 mAh Power Bank", "Brightwire", "Accessories", 24.99, 450, [], "Fast-charge power bank with two USB-C ports."],
  ["Brightwire Electronics", "24-inch Full HD Monitor", "Brightwire", "Monitors", 119.0, 3400, [], "IPS monitor with HDMI and DisplayPort inputs."],

  ["Hearth & Home", "Non-stick Cookware Set, 5 pieces", "Hearth", "Kitchen", 54.0, 4200, [], "Induction-ready pans with glass lids."],
  ["Hearth & Home", "Cotton Duvet Set, King", "Hearth", "Bedding", 38.0, 1800, [{ name: "Colour", values: ["White", "Slate", "Sage"] }], "300-thread-count cotton duvet cover with two pillowcases."],
  ["Hearth & Home", "Digital Air Fryer, 5L", "Hearth", "Kitchen", 69.0, 4800, [], "Eight presets, dishwasher-safe basket."],
  ["Hearth & Home", "Memory Foam Pillow, pair", "Hearth", "Bedding", 28.0, 1600, [], "Contour pillows with a washable cover."],
  ["Hearth & Home", "LED Floor Lamp", "Hearth", "Lighting", 31.0, 2200, [{ name: "Finish", values: ["Black", "Brass"] }], "Dimmable floor lamp with a warm-white bulb."],

  ["Petal & Pine", "Vitamin C Daily Serum, 30ml", "Petal & Pine", "Skincare", 14.5, 120, [], "Brightening serum for all skin types."],
  ["Petal & Pine", "Shea Butter Body Cream, 400ml", "Petal & Pine", "Skincare", 9.99, 480, [], "Rich body cream with shea butter and cocoa butter."],
  ["Petal & Pine", "Daily Multivitamin, 90 tablets", "Petal & Pine", "Wellbeing", 8.49, 140, [], "Once-a-day multivitamin and mineral tablets."],
  ["Petal & Pine", "Silk Hair Wrap", "Petal & Pine", "Hair", 11.0, 80, [{ name: "Colour", values: ["Black", "Rose", "Ivory"] }], "Satin-lined wrap for protecting hair overnight."],
  ["Petal & Pine", "Sunscreen SPF 50, 150ml", "Petal & Pine", "Skincare", 12.0, 220, [], "Lightweight daily face and body sunscreen."],

  ["Fieldmark Sports", "Pro Match Football, size 5", "Fieldmark", "Football", 24.0, 450, [], "Thermally bonded match ball."],
  ["Fieldmark Sports", "Club Replica Training Shirt", "Fieldmark", "Football", 29.99, 250, [SIZES_CLOTH, { name: "Colour", values: ["Red", "White"] }], "Breathable training shirt with a moisture-wicking finish."],
  ["Fieldmark Sports", "Trail Running Shoes", "Fieldmark", "Running", 58.0, 850, [SIZES_SHOE], "Grippy outsole for roads and trails."],
  ["Fieldmark Sports", "Adjustable Dumbbell Set, 20kg", "Fieldmark", "Gym", 62.0, 21000, [], "Spin-lock dumbbells with a carry case."],
  ["Fieldmark Sports", "Yoga Mat, 6mm", "Fieldmark", "Gym", 16.0, 1100, [{ name: "Colour", values: ["Teal", "Charcoal"] }], "Non-slip mat with a carry strap."],

  ["Little Acorn", "Baby Starter Bundle, 0-3 months", "Little Acorn", "Baby", 26.0, 600, [], "Six bodysuits, two sleepsuits and a hat in organic cotton."],
  ["Little Acorn", "Wooden Building Blocks, 100 pieces", "Little Acorn", "Toys", 18.0, 1500, [], "Painted hardwood blocks in a storage tub."],
  ["Little Acorn", "School Backpack", "Little Acorn", "School", 21.0, 600, [{ name: "Colour", values: ["Navy", "Green", "Red"] }], "Padded straps, laptop sleeve and a reflective trim."],
  ["Little Acorn", "Lightweight Pushchair", "Little Acorn", "Baby", 119.0, 7200, [{ name: "Colour", values: ["Grey", "Black"] }], "Folds with one hand; includes a rain cover."],
  ["Little Acorn", "Children's Story Collection, 10 books", "Little Acorn", "Books", 15.0, 1700, [], "Boxed set of illustrated bedtime stories."],

  ["Quill & Page", "Introduction to Algorithms Study Guide", "Quill & Page", "Textbooks", 34.0, 900, [], "Study guide with worked solutions."],
  ["Quill & Page", "Bestselling Novel Bundle, 3 books", "Quill & Page", "Fiction", 19.0, 900, [], "Three current bestsellers in paperback."],
  ["Quill & Page", "A4 Hardback Notebook, 3 pack", "Quill & Page", "Stationery", 9.0, 900, [], "Ruled notebooks with 192 pages each."],
  ["Quill & Page", "Gel Pen Set, 24 colours", "Quill & Page", "Stationery", 7.5, 200, [], "Smooth-writing gel pens."],
  ["Quill & Page", "Business English Workbook", "Quill & Page", "Textbooks", 17.0, 550, [], "Practice exercises with an answer key."],

  ["Torque Tools", "18V Cordless Drill Driver Kit", "Torque", "Power tools", 74.0, 2300, [], "Two batteries, a charger and 30 accessories in a case."],
  ["Torque Tools", "120-piece Socket Set", "Torque", "Hand tools", 39.0, 4100, [], "Chrome-vanadium sockets and ratchets in a carry case."],
  ["Torque Tools", "Car Jump Starter, 12V", "Torque", "Car care", 49.0, 1100, [], "Portable jump starter with a built-in torch."],
  ["Torque Tools", "Tyre Inflator, digital", "Torque", "Car care", 21.0, 800, [], "12V inflator with auto shut-off."],
  ["Torque Tools", "Laser Measure, 40m", "Torque", "Hand tools", 19.0, 220, [], "Compact laser distance meter."],
];

const DEALS: [name: string, wasPounds: number][] = [
  ["Cloud Runner Trainers", 79.99], ["Padded Winter Jacket", 119], ["Pulse Wireless Earbuds", 69.99], ["Orbit 6 Smartphone, 128GB", 259],
  ["Digital Air Fryer, 5L", 89], ["Pro Match Football, size 5", 32], ["18V Cordless Drill Driver Kit", 99], ["Baby Starter Bundle, 0-3 months", 34],
  ["Trail Running Shoes", 75],
];

const SERVICE_FEE: ServiceFeeRule = { mode: "percent", percent: 10, minMinor: 3000 };

const AIR_STANDARD: RateCard = {
  brackets: [
    { upToGrams: 500, priceMinor: 6000 },
    { upToGrams: 1000, priceMinor: 9000 },
    { upToGrams: 2000, priceMinor: 15000 },
    { upToGrams: 5000, priceMinor: 33000 },
    { upToGrams: 10000, priceMinor: 60000 },
  ],
  extraPerKgMinor: 6000,
  minChargeMinor: 7000,
};

const AIR_EXPRESS: RateCard = {
  brackets: [
    { upToGrams: 500, priceMinor: 9500 },
    { upToGrams: 1000, priceMinor: 14000 },
    { upToGrams: 2000, priceMinor: 23000 },
    { upToGrams: 5000, priceMinor: 50000 },
    { upToGrams: 10000, priceMinor: 90000 },
  ],
  extraPerKgMinor: 9000,
  minChargeMinor: 11000,
};

const ZONES: [name: string, areas: string, feeMinor: number, eta: string][] = [
  ["Accra Central", "Osu, Adabraka, Ridge, Cantonments, Labone", 3000, "1 to 2 days"],
  ["East Legon & Airport", "East Legon, Airport Residential, Madina, Adenta", 4000, "1 to 2 days"],
  ["Tema & Spintex", "Tema, Spintex, Teshie, Nungua", 5000, "2 to 3 days"],
  ["Kasoa & West Accra", "Kasoa, Weija, Dansoman, Kaneshie", 6000, "2 to 3 days"],
  ["Other regions", "Kumasi, Takoradi, Tamale and elsewhere in Ghana", 12000, "3 to 6 days"],
];

export function seedIfEmpty(db: Database.Database): void {
  const hasShops = db.prepare("SELECT COUNT(*) AS n FROM shops").get() as { n: number };
  if (hasShops.n > 0) return;

  const insertShop = db.prepare(
    `INSERT INTO shops (slug, name, tagline, category, website_url, description, accent, sort)
     VALUES (@slug, @name, @tagline, @category, '', @description, @accent, @sort)`,
  );
  const insertProduct = db.prepare(
    `INSERT INTO products (shop_id, slug, name, brand, category, description, price_minor, weight_grams, options)
     VALUES (@shop_id, @slug, @name, @brand, @category, @description, @price_minor, @weight_grams, @options)`,
  );
  const setSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");

  const run = db.transaction(() => {
    const ids = new Map<string, number>();
    SHOPS.forEach((s, i) => {
      const r = insertShop.run({ ...s, slug: slugify(s.name), sort: i });
      ids.set(s.name, Number(r.lastInsertRowid));
    });
    for (const [shop, name, brand, category, pounds, grams, options, description] of PRODUCTS) {
      insertProduct.run({
        shop_id: ids.get(shop),
        slug: slugify(`${shop}-${name}`),
        name,
        brand,
        category,
        description,
        price_minor: Math.round(pounds * 100),
        weight_grams: grams,
        options: JSON.stringify(options),
      });
    }

    // Sample "was" prices so the deals shelf has something to show. Replace them in the admin area.
    const setDeal = db.prepare("UPDATE products SET compare_at_minor = ?, deal_ends_at = datetime('now', '+3 days') WHERE name = ?");
    for (const [name, was] of DEALS) setDeal.run(Math.round(was * 100), name);

    const insertMethod = db.prepare(
      "INSERT INTO shipping_methods (code, name, eta, rate_card, sort) VALUES (?, ?, ?, ?, ?)",
    );
    insertMethod.run("air", "Air freight", "8 to 12 days from UK dispatch", JSON.stringify(AIR_STANDARD), 0);
    insertMethod.run("express", "Express air", "4 to 7 days from UK dispatch", JSON.stringify(AIR_EXPRESS), 1);

    const insertZone = db.prepare(
      "INSERT INTO delivery_zones (name, areas, fee_minor, eta, sort) VALUES (?, ?, ?, ?, ?)",
    );
    ZONES.forEach(([n, a, f, e], i) => insertZone.run(n, a, f, e, i));

    setSetting.run("site_name", JSON.stringify("SHOP UK FROM GH"));
    setSetting.run("fx_rate", JSON.stringify(15.2));
    setSetting.run("fx_markup_pct", JSON.stringify(3));
    setSetting.run("service_fee", JSON.stringify(SERVICE_FEE));
    setSetting.run("min_order_gbp_minor", JSON.stringify(1000));
    setSetting.run("support_whatsapp", JSON.stringify(""));
  });
  run();
}
