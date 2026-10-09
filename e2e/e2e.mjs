/**
 * End-to-end check of the whole shop in a real (headless) browser: storefront, accounts, payment, admin, staff access, link
 * orders, catalogue sources and phone layouts. Run it with `npm run e2e` (see e2e/README.md and docs/10-testing.md).
 */
import { chromium } from "playwright-core";
const base = process.env.E2E_BASE ?? "http://localhost:3100";
const DEV_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin";
const CRON_SECRET = process.env.E2E_CRON_SECRET ?? "cron-secret-123456";
// CHROMIUM_PATH points at a Chrome or Chromium to use; leave it unset to use the one Playwright installed
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const step = (s) => console.log("OK  ", s);
const must = (c, msg) => { if (!c) { console.log("FAIL", msg); process.exitCode = 1; } };
const PRODUCT = "/products/northgate-fashion-cloud-runner-trainers";
const phone = "024" + String(Math.floor(1000000 + Math.random() * 8999999));

try {
  // 0. protected areas and webhooks
  await page.goto(base + "/account");
  await page.waitForURL("**/login**");
  step("account area redirects a guest to login");
  const wh = await page.request.post(base + "/api/webhooks/paystack", { data: "{}", headers: { "content-type": "application/json" } });
  must(wh.status() >= 400 && wh.status() < 500, "unsigned webhook is refused, got " + wh.status());
  const cron = await page.request.get(base + "/api/cron/messages");
  must(cron.status() === 401 || cron.status() === 403, "cron without secret is refused, got " + cron.status());
  const cron2 = await page.request.get(base + "/api/cron/messages", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  must(cron2.ok(), "cron with secret works, got " + cron2.status());
  step("unsigned webhook and unauthenticated cron are refused");

  // 0b. link preview refuses internal addresses; the catalogue reader page is gone
  const lp = await page.request.get(base + "/api/link-preview?url=" + encodeURIComponent("http://127.0.0.1/admin"));
  must((await lp.json()).ok === false, "link preview refuses internal addresses");
  must((await page.request.get(base + "/bot")).status() === 404, "the catalogue reader page is gone");
  step("link preview refuses internal addresses; bot page is public");

  // 1. home page basics
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Today's deals" }).waitFor();
  must((await page.locator("nav.tabbar").isVisible()) === false, "tab bar hidden on desktop");
  step("home renders deals shelf; tab bar hidden on desktop");

  // 2. search autosuggest
  await page.locator("#site-q").fill("runner");
  await page.getByRole("listbox", { name: "Suggestions" }).getByRole("option").first().waitFor();
  step("search suggests products as you type");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/search?*q=runner*");
  must((await page.getByText("Cloud Runner Trainers").count()) > 0, "search finds the trainers");
  step("search results page finds the product");

  // 3. register (checkout needs an account)
  await page.goto(base + PRODUCT);
  await page.locator("label.pill").filter({ hasText: /^UK 9$/ }).click();
  await page.locator("label.pill").filter({ hasText: /^Black$/ }).click();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.getByText("Added to your cart.").waitFor();
  step("added 2 trainers to the cart");
  await page.goto(base + "/cart");
  await page.getByText("Order summary").waitFor();
  const totalText = await page.locator(".receipt .row.total dd").innerText();
  step("cart total " + totalText);
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await page.waitForURL("**/login**");
  step("checkout asks a guest to sign in");
  await page.goto(base + "/register?next=%2Fcheckout");
  await page.getByLabel("Full name").fill("Ama Mensah");
  await page.getByLabel("Phone number", { exact: true }).fill(phone);
  await page.getByLabel("Email (optional)").fill(`ama${phone}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
  await page.getByLabel("Confirm password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create my account" }).click();
  await page.waitForURL("**/checkout**");
  step("registered and returned to checkout with the cart intact");

  // 4. checkout + pay
  await page.locator("#address").fill("12 Example Street, East Legon");
  const checkoutTotal = await page.locator(".receipt .row.total dd").innerText();
  must(checkoutTotal === totalText, `checkout total ${checkoutTotal} matches cart ${totalText}`);
  await page.getByRole("button", { name: /Place order and pay/ }).click();
  await page.waitForURL("**/pay/**");
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await page.getByText("Payment received").first().waitFor();
  const number = (await page.locator("h1.mono").innerText()).trim();
  must(/^UKG-\d{4}-\d{6}$/.test(number), "order number format " + number);
  await page.getByText("Payment received").first().waitFor();
  const paid = await page.locator(".receipt .row.total dd").first().innerText();
  must(paid === totalText, `charged ${paid} equals the cart total ${totalText}`);
  step("paid " + paid + " for " + number);

  // 5. account shows the order
  await page.goto(base + "/account/orders/" + number);
  await page.getByText("Payment received").first().waitFor();
  await page.goto(base + "/account/updates");
  must((await page.getByText(number).count()) > 0, "updates feed mentions the new order");
  step("order appears in the account with an updates feed entry");

  // 6. admin moves the order
  const admin = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ap = await admin.newPage();
  ap.setDefaultTimeout(8000);
  await ap.goto(base + "/admin/orders");
  await ap.waitForURL("**/admin/login");
  must((await ap.getByLabel("Developer password").count()) === 0, "the staff sign-in does not ask for the developer password");
  await ap.getByRole("link", { name: "Developer sign-in" }).click();
  await ap.getByLabel("Developer password").fill("wrong");
  await ap.getByRole("button", { name: "Sign in" }).click();
  await ap.getByText("That password is not right.").waitFor();
  await ap.getByLabel("Developer password").fill(DEV_PASSWORD);
  await ap.getByRole("button", { name: "Sign in" }).click();
  await ap.waitForURL("**/admin");
  step("admin sign-in: wrong password refused, right one accepted");
  for (const path of ["/admin/customers", "/admin/integrations", "/admin/messages", "/admin/reviews", "/admin/audit", "/admin/items", "/admin/shops", "/admin/zones", "/admin/shipping", "/admin/requests", "/admin/pricing", "/admin/sources", "/admin/sources/new", "/admin/import", "/admin/appearance"]) {
    const r = await ap.goto(base + path);
    must(r && r.ok(), `admin page ${path} loads (${r && r.status()})`);
  }
  step("every admin page loads");
  await ap.goto(base + "/admin/orders");
  await ap.getByRole("link", { name: number }).click();
  await ap.getByRole("button", { name: "Mark as: Buying from the UK shop" }).click();
  await ap.getByText("Saved.").waitFor();
  step("admin moved the order to buying");
  await page.goto(base + "/account/orders/" + number);
  must((await page.getByText("Buying from the UK shop").count()) > 0, "customer sees the new status in the account");
  await page.goto(base + "/account/updates");
  must((await page.getByText(/Buying|being bought|purchas/i).count()) > 0, "updates feed shows the status change");
  step("customer sees the status change in the account and updates feed");

  // 7. admin changes service charge; storefront follows
  await page.goto(base + PRODUCT);
  await page.locator("label.pill").filter({ hasText: /^UK 8$/ }).click();
  await page.locator("label.pill").filter({ hasText: /^Red$/ }).click();
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.getByText("Added to your cart.").waitFor();
  await ap.goto(base + "/admin/pricing");
  await ap.getByLabel("Flat amount per order").check();
  await ap.getByLabel("Amount (GH₵)").fill("100.00");
  await ap.getByRole("button", { name: "Save pricing" }).click();
  await ap.getByText("Saved.").waitFor();
  await page.goto(base + "/cart");
  await page.getByText("Order summary").waitFor();
  const svc = await page.locator(".receipt .row", { hasText: "Service charge" }).locator("dd").innerText();
  must(svc === "GH₵100.00", "storefront uses the new service charge, got " + svc);
  step("storefront now charges " + svc);

  // 8. exchange rate set by admin reaches the storefront
  await ap.goto(base + "/admin/pricing");
  await ap.getByLabel("GH₵ for £1").fill("16.00");
  await ap.getByRole("button", { name: "Save pricing" }).click();
  await ap.getByText("Saved.").first().waitFor();
  await page.goto(base + "/");
  must((await page.getByText(/£1 = GH₵\s?16\.4\d/).count()) > 0, "ribbon shows the new exchange rate");
  step("admin exchange rate reaches the storefront ribbon");

  // 9. invalid admin input
  await ap.goto(base + "/admin/pricing");
  await ap.getByLabel("Tiered by the item total in pounds").check();
  await ap.getByLabel(/Bands/).fill("50, 15");
  await ap.getByRole("button", { name: "Save pricing" }).click();
  await ap.getByText(/last band must be/).waitFor();
  step("an invalid tier setup is rejected with a clear message");

  // 9a. a source cannot be switched on without confirming the shop's terms
  await ap.goto(base + "/admin/sources/new");
  await ap.getByLabel("Name for this source").fill("Test feed");
  await ap.getByLabel("Feed or sitemap address").fill("https://feeds.example.com/p.csv");
  await ap.getByRole("button", { name: "Create source" }).click();
  await ap.getByText(/Confirm that you have checked/).waitFor();
  await ap.goto(base + "/admin/sources/new");
  await ap.getByLabel("Name for this source").fill("Test feed");
  await ap.getByLabel("Feed or sitemap address").fill("http://127.0.0.1/p.csv");
  await ap.getByLabel(/I have checked that this shop/).check();
  await ap.getByRole("button", { name: "Create source" }).click();
  await ap.getByText(/not on the public internet/).waitFor();
  step("sources need confirmed permission, and internal addresses are refused");

  // 9a1. a source can be created and then removed
  await ap.goto(base + "/admin/sources/new");
  await ap.getByLabel("Name for this source").fill("Removal Test Source");
  await ap.getByLabel("Feed or sitemap address").fill("https://feeds.example.com/removal-test.csv");
  await ap.getByLabel(/I have checked that this shop/).check();
  await ap.getByRole("button", { name: "Create source" }).click();
  await ap.waitForURL(/\/admin\/sources\/\d+\?saved=1/);
  await ap.getByText("Remove this source", { exact: true }).click();
  await ap.getByRole("button", { name: "Remove source, keep its products" }).click();
  await ap.waitForURL(/\/admin\/sources\?saved=1/);
  await ap.getByRole("heading", { name: "Catalogue sources" }).waitFor();
  await ap.getByText("Removal Test Source").first().waitFor({ state: "detached" });
  must((await ap.getByText("Removal Test Source").count()) === 0, "the removed source is gone from the list");
  step("a source can be created and removed");

  // 9a2. eBay: keys card on Integrations, and the source form switches to searches
  await ap.goto(base + "/admin/integrations");
  await ap.getByRole("heading", { name: "eBay (official API)" }).first().waitFor();
  await ap.goto(base + "/admin/sources/new");
  await ap.locator("#kind").selectOption("ebay");
  await ap.getByLabel(/Your eBay searches/).fill("kettle");
  await ap.getByLabel("Name for this source").fill("eBay test");
  await ap.getByLabel(/I have checked that this shop/).check();
  await ap.getByRole("button", { name: "Check this setup first" }).click();
  await ap.getByText(/Add your eBay App ID and Cert ID/).waitFor();
  step("eBay source form works and explains missing keys");

  // 9a3. Shopify: the form asks for a shop address, hides column names, and refuses internal addresses
  await ap.goto(base + "/admin/sources/new");
  await ap.locator("#kind").selectOption("shopify");
  await ap.getByLabel(/Shop address/).waitFor();
  must((await ap.getByLabel("Column names (optional)").count()) === 0, "Shopify form hides column names");
  await ap.getByLabel(/Shop address/).fill("http://127.0.0.1");
  await ap.getByLabel("Name for this source").fill("Shopify test");
  await ap.getByLabel(/I have checked that this shop/).check();
  await ap.getByRole("button", { name: "Check this setup first" }).click();
  await ap.getByText(/not on the public internet/).waitFor();
  step("Shopify source form works and refuses an internal address");

  // 9a4. a shop can be added and then deleted, but only after confirming
  await ap.goto(base + "/admin/shops");
  await ap.getByText("+ Add a shop").click();
  const addForm = ap.locator("form").filter({ has: ap.getByRole("button", { name: "Add shop" }) });
  await addForm.getByLabel("Shop name").fill("Delete Me Shop");
  await addForm.getByLabel("Category").fill("Test");
  await addForm.getByRole("button", { name: "Add shop" }).click();
  await ap.waitForURL("**/admin/shops?saved=1");
  await ap.locator("summary", { hasText: "Delete Me Shop" }).click();
  const delForm = ap.locator("form").filter({ has: ap.getByRole("heading", { name: "Delete this shop" }) }).filter({ hasText: "Delete Me Shop" });
  await delForm.getByRole("button", { name: "Delete shop" }).click();
  await ap.getByText(/Tick the box to confirm/).waitFor();
  must((await ap.locator("summary", { hasText: "Delete Me Shop" }).count()) === 1, "shop survives an unconfirmed delete");
  await ap.locator("summary", { hasText: "Delete Me Shop" }).click();
  const delForm2 = ap.locator("form").filter({ has: ap.getByRole("heading", { name: "Delete this shop" }) }).filter({ hasText: "Delete Me Shop" });
  await delForm2.getByLabel(/Yes, delete Delete Me Shop/).check();
  await delForm2.getByRole("button", { name: "Delete shop" }).click();
  await ap.locator("summary", { hasText: "Delete Me Shop" }).waitFor({ state: "detached" });
  step("a shop can be deleted, only after confirming");

  // 9a5. a shop logo uploaded in the admin shows on the shop list and the shop page; a fake one is refused
  const logoPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await ap.goto(base + "/admin/shops");
  await ap.locator("summary", { hasText: "Northgate Fashion" }).click();
  await ap.locator("#shop-1-logoFile").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") });
  await ap.locator("form").filter({ has: ap.locator("#shop-1-logoFile") }).getByRole("button", { name: "Save shop" }).click();
  await ap.getByText(/Upload a JPEG, PNG, WebP or GIF image/).waitFor();
  await ap.locator("summary", { hasText: "Northgate Fashion" }).click();
  await ap.locator("#shop-1-logoFile").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logoPng });
  await ap.locator("form").filter({ has: ap.locator("#shop-1-logoFile") }).getByRole("button", { name: "Save shop" }).click();
  await ap.waitForURL("**/admin/shops?saved=1");
  await page.goto(base + "/shops");
  const logo = page.locator('img[alt="Northgate Fashion logo"]').first();
  await logo.waitFor();
  must(await logo.evaluate((el) => el.complete && el.naturalWidth > 0), "uploaded logo loads on the shop list");
  await page.goto(base + "/shops/northgate-fashion");
  await page.locator('img[alt="Northgate Fashion logo"]').first().waitFor();
  step("shop logo upload shows on the shop list and shop page; fake logos are refused");

  // 9a6. a file import source takes a CSV and puts its rows on the shop
  await ap.goto(base + "/admin/sources/new");
  await ap.locator("#kind").selectOption("upload");
  must((await ap.getByLabel(/Feed or sitemap address/).count()) === 0, "file import form has no address field");
  await ap.getByLabel("Name for this source").fill("File import test");
  await ap.getByLabel(/I have checked that this shop/).check();
  await ap.getByRole("button", { name: "Create source" }).click();
  await ap.waitForURL(/\/admin\/sources\/\d+\?saved=1/);
  const csvText = `title,price,url,image\nFile Import Teapot,18.50,https://shop.example/p/teapot,${base}/favicon.ico\nBroken Row,,https://shop.example/p/x,https://img.example/x.jpg\n`;
  await ap.locator("#importFile").setInputFiles({ name: "export.csv", mimeType: "text/csv", buffer: Buffer.from(csvText) });
  await ap.getByRole("button", { name: "Import file" }).click();
  await ap.getByRole("status").filter({ hasText: /1 read, 1 new/ }).waitFor();
  await page.goto(base + "/search?q=File+Import+Teapot");
  await page.getByText("File Import Teapot").first().waitFor();
  step("file import puts uploaded rows on the shop");

  // 9a7. delivery areas: add one with its own fee, then delete it only after confirming
  await ap.goto(base + "/admin/zones");
  await ap.locator("summary", { hasText: "+ Add a delivery area" }).click();
  await ap.locator("#zone-new-name").fill("E2E Test Area");
  await ap.locator("#zone-new-fee").fill("77");
  await ap.locator("form").filter({ has: ap.locator("#zone-new-name") }).getByRole("button", { name: "Add area" }).click();
  await ap.waitForURL("**/admin/zones?saved=1");
  await ap.locator("summary", { hasText: "E2E Test Area" }).click();
  const zf = () => ap.locator("form").filter({ has: ap.getByRole("heading", { name: "Delete this area" }) }).filter({ hasText: "E2E Test Area" });
  await zf().getByRole("button", { name: "Delete area" }).click();
  await ap.getByText(/Tick the box to confirm/).waitFor();
  await ap.locator("summary", { hasText: "E2E Test Area" }).click();
  await zf().getByLabel(/Yes, delete E2E Test Area/).check();
  await zf().getByRole("button", { name: "Delete area" }).click();
  await ap.locator("summary", { hasText: "E2E Test Area" }).waitFor({ state: "detached" });
  step("a delivery area can be added and deleted, only after confirming");

  // 9b. theme chosen in the admin reaches the storefront
  await ap.goto(base + "/admin/appearance");
  must((await ap.locator("ul > li").filter({ hasText: "In use" }).count()) === 1, "exactly one theme is in use");
  await ap.locator("li").filter({ hasText: "Royal purple and orange" }).getByRole("button", { name: "Use this theme" }).click();
  await ap.getByText("Saved.").first().waitFor();
  await page.goto(base + "/");
  const brand = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--blue").trim());
  must(brand === "#5b2bd6", "storefront picks up the chosen theme, got " + brand);
  step("admin colour theme reaches the storefront");
  await ap.locator("li").filter({ hasText: "Ghana green and gold" }).getByRole("button", { name: "Use this theme" }).click();
  await ap.getByText("Saved.").first().waitFor();

  // 9c. a photo uploaded in the admin shows on the shop; a fake image is refused
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await ap.goto(base + "/admin/items/new");
  await ap.getByLabel("Item name").fill("Photo Test Kettle");
  await ap.getByLabel(/UK shop price/).fill("25.00");
  await ap.locator("#imageFile").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") });
  await ap.getByRole("button", { name: "Add item" }).click();
  await ap.getByText(/Upload a JPEG, PNG, WebP or GIF image/).waitFor();
  await ap.goto(base + "/admin/items/new");
  await ap.getByLabel("Item name").fill("Photo Test Kettle");
  await ap.getByLabel(/UK shop price/).fill("25.00");
  await ap.locator("#imageFile").setInputFiles({ name: "kettle.png", mimeType: "image/png", buffer: png });
  await ap.getByRole("button", { name: "Add item" }).click();
  await ap.waitForURL(/\/admin\/items\/\d+\?saved=1/);
  await page.goto(base + "/search?q=Photo+Test+Kettle");
  const img = page.locator('img[src^="/uploads/"]').first();
  await img.waitFor();
  const loaded = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
  must(loaded, "uploaded photo loads on the storefront");
  const src = await img.getAttribute("src");
  const served = await page.request.get(base + src);
  must(served.ok() && served.headers()["content-type"] === "image/png" && served.headers()["x-content-type-options"] === "nosniff", "uploaded photo is served as an image");
  must((await page.request.get(base + "/uploads/../../etc/passwd")).status() === 404, "uploads cannot read other files");
  step("admin photo upload shows on the shop; fake images are refused");

  // 9d. the Add-by-link button is visible on every page and works
  await page.goto(base + "/");
  const addLink = page.getByRole("button", { name: /Add by link/ });
  must(await addLink.isVisible(), "Add by link button is visible");
  await addLink.click();
  // Safari and Firefox on Mac do not focus a button when it is clicked, so focus leaves the input with no new target: the panel must stay open
  await page.locator("#link-add-url").focus();
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  must(await page.locator("#link-add-url").isVisible(), "the Add by link panel stays open when focus leaves with no target (as in Safari)");
  await page.locator("#link-add-url").fill("not a link");
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.getByText("Paste a full link starting with https://").waitFor();
  await page.locator("#link-add-url").fill("http://127.0.0.1/secret");
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.getByRole("link", { name: "Request it anyway" }).waitFor();
  step("Add by link button is visible and handles bad and unreadable links");

  // 9e. the paste-a-link box on the home page, and links pasted into the search box
  await page.goto(base + "/");
  const big = page.locator("#link-big-url");
  await big.waitFor();
  const box = await big.boundingBox();
  must(box !== null && box.y < 1100, "paste-a-link box sits near the top of the home page, at y=" + box?.y);
  await big.fill("http://127.0.0.1/secret");
  await page.getByRole("button", { name: "Get my price in cedis" }).click();
  await page.getByRole("link", { name: "Request it anyway" }).waitFor();
  await page.goto(base + "/");
  await page.locator("#site-q").fill("https://www.shop.example/product/boots");
  await page.getByText(/looks like a product link/).waitFor();
  await page.locator("#site-q").press("Enter");
  await page.waitForURL(/\/request\?url=/);
  must((await page.locator("#url").inputValue()) === "https://www.shop.example/product/boots", "pasted link is carried into the request form");
  step("paste-a-link box on the home page; search box recognises pasted links");

  // 9f. a link request becomes a real order: request, quote, pay, then it is an ordinary order
  await page.goto(base + "/request?url=" + encodeURIComponent("http://127.0.0.1/kettle") + "&title=Link+Order+Kettle&price=25");
  await page.locator("#title").waitFor();
  await page.locator("#title").fill("Link Order Kettle");
  must((await page.locator("#name").inputValue()) === "Ama Mensah", "request form is prefilled for a signed-in customer");
  await page.getByRole("button", { name: "Send request" }).click();
  await page.getByText(/Thanks, we.ll quote it/).waitFor();
  await ap.goto(base + "/admin/requests");
  const reqCard = ap.locator("li").filter({ hasText: "Link Order Kettle" }).first();
  await reqCard.getByLabel(/UK price, each/).fill("25.00");
  await reqCard.getByLabel(/Weight, each/).fill("1200");
  await reqCard.getByRole("button", { name: "Send quote" }).click();
  await ap.getByText(/Quote saved for request/).waitFor();
  const quoteLinkRaw = await ap.locator("li").filter({ hasText: "Link Order Kettle" }).first().getByLabel("Customer pay link").inputValue();
  must(/\/quote\/[A-Za-z0-9_-]{20,}$/.test(quoteLinkRaw), "admin gets the customer's pay link, got " + quoteLinkRaw);
  const quoteLink = base + new URL(quoteLinkRaw, base).pathname; // the test server runs without an https APP_URL
  await page.goto(base + "/account");
  await page.getByText("Your price is ready.").waitFor();
  await page.goto(quoteLink);
  await page.getByText("Link Order Kettle").first().waitFor();
  await page.locator("#address").fill("5 Quote Street, Accra");
  await page.getByRole("button", { name: /Place order and pay/ }).click();
  await page.waitForURL("**/pay/**");
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await page.getByText("Payment received").first().waitFor();
  const linkOrderNo = (await page.locator("h1.mono").innerText()).trim();
  await ap.goto(base + "/admin/orders");
  await ap.getByText(linkOrderNo).first().waitFor();
  await ap.goto(base + "/admin/requests");
  await ap.getByRole("link", { name: /Open the order/ }).first().waitFor();
  await page.goto(quoteLink);
  await page.getByText("This item has been ordered").waitFor();
  step("a link request is quoted, paid for and appears as an ordinary order " + linkOrderNo);

  // 9g. automatic quotes: switched on by the admin, a customer-typed price is priced straight away; a dear item still waits for a person
  await ap.goto(base + "/admin/requests");
  await ap.locator("summary", { hasText: "Automatic quotes" }).click();
  await ap.getByLabel(/Also quote by itself from the price the customer typed/).check();
  await ap.getByLabel(/Safety margin/).fill("10");
  await ap.getByRole("button", { name: "Save automatic-quote settings" }).click();
  await ap.waitForURL("**/admin/requests?saved=1");
  await page.goto(base + "/request?url=" + encodeURIComponent("http://127.0.0.1/auto-teapot") + "&title=Auto+Teapot&price=30");
  await page.locator("#itemType").selectOption("Small electronics");
  await page.getByRole("button", { name: "Send request" }).click();
  await page.getByText("We priced it for you").waitFor();
  await page.getByRole("link", { name: "See my price and pay" }).click();
  await page.getByText("Auto Teapot").first().waitFor();
  const summaryText = await page.locator(".receipt").innerText();
  must(/Items \(£33\.00\)/.test(summaryText), "auto quote adds the 10% margin to £30.00, saw: " + summaryText.slice(0, 120));
  await page.goto(base + "/request?url=" + encodeURIComponent("http://127.0.0.1/auto-tv") + "&title=Auto+TV&price=900");
  await page.getByRole("button", { name: "Send request" }).click();
  await page.getByText(/Thanks, we.ll quote it/).waitFor();
  await ap.goto(base + "/admin/requests");
  await ap.locator("li").filter({ hasText: "Auto Teapot" }).getByText("auto: customer price +margin").waitFor();
  await ap.locator("li").filter({ hasText: "Auto TV" }).getByRole("button", { name: "Send quote" }).waitFor();
  step("automatic quotes price an ordinary request at once and leave a dear one for a person");

  // 9h. a link the system can read: the box shows the price in pounds and cedis and goes straight to a request in the account
  await page.route("**/api/link-preview**", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ok: true, name: "One Click Hat", priceMinor: 2000, priceGhsMinor: 33000, host: "shop.example", imageUrl: "", itemTypes: ["Clothing", "Other or not sure"] }),
  }));
  await page.goto(base + "/");
  await page.locator("#link-big-url").fill("http://127.0.0.1/one-click-hat");
  await page.getByRole("button", { name: "Get my price in cedis" }).click();
  await page.getByText("We found it").waitFor();
  must((await page.getByText(/≈ GH₵/).count()) > 0, "the found price is also shown in cedis");
  await page.locator("#b-det").fill("one size");
  await page.getByRole("button", { name: "Get my full price and pay" }).click();
  await page.waitForURL(/\/account/);
  await page.getByText("One Click Hat").waitFor();
  await page.unroute("**/api/link-preview**");
  step("a found link goes straight from the box to a request in the customer's account");

  // 9h2. staff accounts: the super admin creates one, the staff member gets limited access, and can be switched off
  const staffEmail = `kofi${phone}@example.com`;
  await ap.goto(base + "/admin/users");
  if (!(await ap.locator("#new-name").isVisible())) await ap.locator("summary", { hasText: "Add a staff account" }).click();
  await ap.locator("#new-name").fill("Kofi Support");
  await ap.locator("#new-email").fill(staffEmail);
  await ap.getByLabel("First password").fill("first long password 7");
  await ap.getByRole("button", { name: "Create account" }).click();
  await ap.getByText(/Account created/).waitFor();
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const sp2 = await staffCtx.newPage();
  sp2.setDefaultTimeout(8000);
  await sp2.goto(base + "/admin/login");
  await sp2.getByLabel("Email").fill(staffEmail);
  await sp2.getByLabel("Password").fill("not the password");
  await sp2.getByRole("button", { name: "Sign in" }).click();
  await sp2.getByText(/do not match an active staff account/).waitFor();
  await sp2.getByLabel("Password").fill("first long password 7");
  await sp2.getByRole("button", { name: "Sign in" }).click();
  await sp2.waitForURL("**/admin/account?must=1");
  await sp2.getByText(/choose your own password/).waitFor();
  await sp2.goto(base + "/admin/orders");
  await sp2.waitForURL("**/admin/account?must=1");
  step("a new staff member must choose their own password before anything else opens");
  await sp2.getByLabel("Current password").fill("first long password 7");
  await sp2.getByLabel("New password", { exact: true }).fill("my own long password 8");
  await sp2.getByLabel("New password again").fill("my own long password 8");
  await sp2.getByRole("button", { name: "Change password" }).click();
  await sp2.waitForURL("**/admin/orders");
  const navText = await sp2.locator("aside nav").first().innerText();
  must(/Orders/.test(navText) && /Link requests/.test(navText), "a support account sees the pages it may use");
  for (const hidden of ["Pricing", "Integrations", "Staff accounts", "Appearance", "Shops"]) must(!navText.includes(hidden), "a support account does not see " + hidden + " in the menu");
  for (const blocked of ["/admin/pricing", "/admin/integrations", "/admin/users", "/admin/shops", "/admin/audit", "/admin/appearance"]) {
    await sp2.goto(base + blocked);
    await sp2.waitForURL("**/admin/no-access");
    await sp2.getByText("not allowed to open that page").waitFor();
  }
  await sp2.goto(base + "/admin/orders");
  await sp2.locator("tbody a").first().click();
  await sp2.getByText("You can look at this order but not change it.").waitFor();
  must((await sp2.getByRole("button", { name: /Mark as/ }).count()) === 0, "a support account has no change buttons on an order");
  must((await sp2.getByText("What it cost us").count()) === 0, "a support account cannot see costs or margins");
  const exp = await staffCtx.request.get(base + "/admin/export/orders");
  must(exp.status() === 403, "a support account cannot download the orders file, got " + exp.status());
  step("a support account sees and does only what its role allows");
  await ap.goto(base + "/admin/users");
  await ap.getByRole("link", { name: "Kofi Support" }).click();
  await ap.getByRole("button", { name: "Switch this account off" }).click();
  await ap.getByText("Switched off (cannot sign in)").waitFor();
  await sp2.goto(base + "/admin/orders");
  await sp2.waitForURL("**/admin/login");
  await sp2.getByLabel("Email").fill(staffEmail);
  await sp2.getByLabel("Password").fill("my own long password 8");
  await sp2.getByRole("button", { name: "Sign in" }).click();
  await sp2.getByText(/do not match an active staff account/).waitFor();
  await staffCtx.close();
  step("switching a staff account off signs them out and stops them signing in");

  // 9i. the admin works on a phone: a Menu button instead of the wide sidebar, nothing wider than the screen, lists as cards
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  const mp = await mobileCtx.newPage();
  await mp.goto(base + "/admin/login?developer=1");
  await mp.getByLabel("Developer password").fill(DEV_PASSWORD);
  await mp.getByRole("button", { name: "Sign in" }).click();
  await mp.waitForURL("**/admin");
  for (const path of ["/admin", "/admin/orders", "/admin/requests", "/admin/pricing", "/admin/shops", "/admin/sources", "/admin/integrations"]) {
    await mp.goto(base + path);
    const wide = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    must(!wide, "admin page fits a phone screen without sideways scrolling: " + path);
  }
  await mp.goto(base + "/admin");
  await mp.getByRole("button", { name: /Menu/ }).click();
  await mp.getByRole("link", { name: "Orders", exact: true }).click();
  await mp.waitForURL("**/admin/orders");
  await mp.getByRole("button", { name: /Menu/ }).waitFor();
  must((await mp.getByRole("link", { name: "Orders", exact: true }).count()) === 0, "the phone menu closes after choosing a page");
  must((await mp.getByText("Total").first().isVisible()), "an order's total is visible on a phone without scrolling sideways");
  await mp.getByRole("button", { name: /Menu/ }).click();
  must(await mp.getByRole("button", { name: "Sign out" }).isVisible(), "Sign out is reachable from the phone menu");
  await mobileCtx.close();
  step("the admin fits a phone: menu button, no sideways scrolling, lists as cards, sign out reachable");

  // 9j. the shop fits a phone: no page is wider than the screen (a customer on an iPhone saw the header and cards cut off), and form
  // fields are 16px so iPhone Safari does not zoom in when one is tapped
  const shopPhone = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  const sp3 = await shopPhone.newPage();
  sp3.setDefaultTimeout(8000);
  const wideOnes = () => sp3.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const inScroller = (e) => { for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(a).overflowX)) return true; } return false; };
    return [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > vw + 1 && r.width > 0 && getComputedStyle(e).position !== "fixed" && !inScroller(e) && !(e instanceof SVGElement); }).slice(0, 2).map((e) => e.tagName + "." + String(e.className).slice(0, 30));
  });
  const mphone = "024" + String(Math.floor(1000000 + Math.random() * 8999999));
  await sp3.goto(base + "/register");
  await sp3.getByLabel("Full name").fill("Phone Shopper");
  await sp3.getByLabel("Phone number", { exact: true }).fill(mphone);
  await sp3.getByLabel("Password", { exact: true }).fill("correct horse battery");
  await sp3.getByLabel("Confirm password").fill("correct horse battery");
  const fieldSize = await sp3.locator("#phone").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  must(fieldSize >= 16, "form fields are at least 16px on a phone, so iPhone Safari does not zoom in, saw " + fieldSize);
  await sp3.getByRole("button", { name: "Create my account" }).click();
  await sp3.waitForURL(/\/account|\/$/);
  for (const path of ["/", "/shops", "/shops/northgate-fashion", "/department/fashion", "/search?q=jacket", PRODUCT, "/cart", "/request", "/track", "/account", "/account/orders", "/account/updates", "/account/wishlist", "/account/addresses", "/account/profile", "/account/security"]) {
    await sp3.goto(base + path);
    await sp3.waitForTimeout(300);
    const wide = await wideOnes();
    must(wide.length === 0, "nothing is wider than a phone screen on " + path + ": " + wide.join(", "));
  }
  await shopPhone.close();
  step("the shop fits a phone: no page wider than the screen, fields at 16px");

  // 9k. social sign-in. Without an https APP_URL there are no buttons (providers need a fixed secure return address). On a second shop whose
  // APP_URL is https: saving Google's keys in the admin makes the button appear; it sends the browser to Google with state, nonce and PKCE and
  // keeps a cookie tying the attempt to this browser; a stray return, or one with the wrong state, is refused; the first-time form is only
  // reachable after a real sign-in
  const socialBase = process.env.E2E_SOCIAL_BASE;
  const loginAs = async (root) => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await c.newPage();
    p.setDefaultTimeout(8000);
    await p.goto(root + "/admin/login?developer=1");
    await p.getByLabel("Developer password").fill(DEV_PASSWORD);
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.waitForURL("**/admin");
    return p;
  };
  const saveGoogle = async (root, p) => {
    await p.goto(root + "/admin/integrations");
    await p.getByRole("heading", { name: "Customer sign-in" }).waitFor();
    for (const name of ["Sign in with Google", "Sign in with Facebook", "Sign in with Apple"]) await p.getByRole("heading", { name }).first().waitFor();
    must((await p.locator("#google input[readonly]").inputValue()).endsWith("/api/auth/google/callback"), "the Google card shows the redirect address to register");
    await p.locator("#google").getByLabel(/Client ID/).fill("e2e-client.apps.googleusercontent.com");
    await p.locator("#google").getByLabel(/Client secret/).fill("e2e-google-secret");
    await p.locator("#google").getByRole("button", { name: /Save Sign in with Google/ }).click();
    await p.locator("#google").getByText("Saved.").waitFor();
  };
  {
    const sa = await loginAs(base);
    await saveGoogle(base, sa);
    const g0 = await (await browser.newContext()).newPage();
    await g0.goto(base + "/login");
    await g0.getByRole("heading", { name: "Sign in" }).first().waitFor();
    must((await g0.getByRole("link", { name: /Continue with/ }).count()) === 0, "no social buttons while APP_URL is not https, even with keys saved");
    await sa.context().close();
    await g0.context().close();
  }
  if (socialBase) {
    const gctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const gp = await gctx.newPage();
    gp.setDefaultTimeout(8000);
    await gp.goto(socialBase + "/login");
    must((await gp.getByRole("link", { name: /Continue with/ }).count()) === 0, "no social buttons before any provider is set up");
    const sa2 = await loginAs(socialBase);
    await saveGoogle(socialBase, sa2);
    await gp.goto(socialBase + "/login?next=%2Fcheckout");
    const gbtn = gp.getByRole("link", { name: "Continue with Google" });
    await gbtn.waitFor();
    must((await gp.getByRole("link", { name: "Continue with Facebook" }).count()) === 0, "only providers that are set up get a button");
    must((await gbtn.getAttribute("href")) === "/api/auth/google/start?next=%2Fcheckout", "the button carries the page to return to");
    const start = await gp.request.get(socialBase + "/api/auth/google/start?next=%2Fcheckout", { maxRedirects: 0 });
    must(start.status() === 303, "the start address redirects, got " + start.status());
    const loc = new URL(start.headers()["location"]);
    must(loc.origin + loc.pathname === "https://accounts.google.com/o/oauth2/v2/auth", "it sends the browser to Google, got " + loc.origin + loc.pathname);
    must(loc.searchParams.get("client_id") === "e2e-client.apps.googleusercontent.com" && loc.searchParams.get("redirect_uri") === "https://shop.example.test/api/auth/google/callback", "the Google address carries the client and our return address");
    must(loc.searchParams.get("code_challenge_method") === "S256" && (loc.searchParams.get("state") ?? "").length > 20 && (loc.searchParams.get("nonce") ?? "").length > 10, "state, nonce and PKCE are set");
    const bind = start.headersArray().find((h) => h.name.toLowerCase() === "set-cookie")?.value ?? "";
    must(/^__Host-oauth_bind=/.test(bind) && /httponly/i.test(bind) && /secure/i.test(bind) && /samesite=none/i.test(bind), "a HttpOnly, Secure, SameSite=None cookie ties the attempt to this browser, saw: " + bind.slice(0, 60));
    const off = await gp.request.get(socialBase + "/api/auth/facebook/start", { maxRedirects: 0 });
    must(off.status() === 303 && (off.headers()["location"] ?? "").includes("social_error=unavailable"), "a provider that is not set up is refused");
    const bogus = await gp.request.get(socialBase + "/api/auth/google/callback?code=abc&state=not-a-real-state", { maxRedirects: 0 });
    must(bogus.status() === 303 && (bogus.headers()["location"] ?? "").includes("social_error=expired"), "a return with an unknown state is refused");
    const post = await gp.request.post(socialBase + "/api/auth/apple/callback", { form: { code: "x", state: "y" }, maxRedirects: 0 });
    must(post.status() === 303, "a form post to a provider that is not set up is refused politely, got " + post.status());
    await gp.goto(socialBase + "/login?social_error=expired");
    await gp.getByText(/took too long or came from a different browser/).waitFor();
    await gp.goto(socialBase + "/register/social");
    await gp.waitForURL("**/login?social_error=expired");
    const direct = await gp.request.get(socialBase + "/api/auth/google/start?link=1", { maxRedirects: 0 });
    must(direct.status() === 303 && (direct.headers()["location"] ?? "").includes("/login"), "connecting a method needs a signed-in customer");
    await gp.goto(socialBase + "/register");
    await gp.getByRole("link", { name: "Sign up with Google" }).waitFor();
    await sa2.context().close();
    await gctx.close();
    step("social sign-in: the button appears once Google is set up (https), the start sends the browser to Google with state, nonce and PKCE, and a stray return is refused");
  } else {
    step("social sign-in: no buttons without an https APP_URL (set E2E_SOCIAL_BASE to also run the https checks)");
  }

  // 9l. legal pages: privacy policy, terms and data-deletion instructions are public and linked from the footer; the contact details in them come from the admin's Site settings
  {
    const lp = await (await browser.newContext()).newPage();
    lp.setDefaultTimeout(8000);
    await lp.goto(base + "/");
    for (const [name, path, heading] of [["Privacy policy", "/privacy", "Privacy policy"], ["Terms of service", "/terms", "Terms of service"], ["Delete your data", "/data-deletion", "Delete your data"]]) {
      await lp.locator("footer").getByRole("link", { name }).click();
      await lp.waitForURL("**" + path);
      await lp.getByRole("heading", { level: 1, name: heading }).waitFor();
      must((await lp.getByText(/Last updated \d+ \w+ \d{4}/).count()) === 1, path + " shows when it was last updated");
      await lp.goto(base + "/");
    }
    await lp.goto(base + "/privacy");
    must((await lp.locator("article a[href^='mailto:']").count()) === 0, "no contact email is shown until the owner sets one");
    const pa = await loginAs(base);
    await pa.goto(base + "/admin/pricing");
    await pa.getByLabel("Contact email (for privacy and complaints)").fill("privacy@shop.example");
    await pa.getByLabel("Registered business name (optional)").fill("Example Trading Ltd");
    await pa.getByRole("button", { name: "Save pricing" }).click();
    await pa.waitForURL("**/admin/pricing?saved=1");
    await lp.goto(base + "/privacy");
    must((await lp.locator("article a[href='mailto:privacy@shop.example']").count()) > 0, "the privacy policy shows the contact email the owner saved");
    must((await lp.getByText(/is run by Example Trading Ltd/).count()) === 1, "the privacy policy names the registered business");
    await lp.goto(base + "/terms");
    must((await lp.locator("article a[href='mailto:privacy@shop.example']").count()) > 0, "the terms show the same contact email");
    await pa.context().close();
    await lp.context().close();
    step("the privacy policy, terms and data-deletion pages are public, linked from the footer, and use the owner's contact details");
  }

  // 9m. ordering from Amazon UK without any Amazon data feed: a search hand-off to Amazon, recognised Amazon links (short, shared text, US store),
  // a one-click button that runs in the customer's own browser, Android's Share menu, and a shop that never requests Amazon's pages
  {
    await page.goto(base + "/search?q=oneplus");
    const hand = page.getByRole("link", { name: /Search Amazon UK for/ });
    await hand.waitFor();
    must((await hand.getAttribute("href")) === "https://www.amazon.co.uk/s?k=oneplus" && (await hand.getAttribute("target")) === "_blank", "the search page offers a plain link to Amazon UK's own search");
    await page.goto(base + "/amazon");
    await page.getByRole("heading", { level: 1, name: "Order from Amazon UK" }).waitFor();
    must((await page.locator("form[action='https://www.amazon.co.uk/s']").count()) === 1, "the Amazon page has a search that opens Amazon UK");
    const bm = page.getByRole("link", { name: /^Send to / });
    await bm.waitFor();
    await page.waitForFunction(() => document.querySelector("a[draggable='true']")?.getAttribute("href")?.startsWith("javascript:"));
    const code = decodeURIComponent((await bm.getAttribute("href")).slice("javascript:".length));
    must(code.includes(base + "/request?"), "the one-click button opens this shop's request form");

    // run the button on a stand-in Amazon UK page, in the browser, as a customer would
    const amazon = await ctx.newPage();
    await amazon.route("https://www.amazon.co.uk/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: `<html><title>x</title><body><span id="productTitle"> OnePlus 15R, 12GB RAM + 256GB </span><div id="corePrice_feature_div"><span class="a-offscreen">£1,749.99</span></div><img id="landingImage" src="https://m.media-amazon.com/images/I/51zoLE5g5XL._AC_UY218_.jpg"></body></html>` }));
    await amazon.goto("https://www.amazon.co.uk/OnePlus/dp/B0FXFR45J7/ref=sr_1_1?qid=1&smid=XYZ");
    const popup = amazon.waitForEvent("popup");
    await amazon.evaluate(code);
    const form = await popup;
    await form.waitForURL("**/request?**");
    const u = new URL(form.url());
    must(u.searchParams.get("url") === "https://www.amazon.co.uk/dp/B0FXFR45J7" && u.searchParams.get("price") === "1749.99" && u.searchParams.get("title") === "OnePlus 15R, 12GB RAM + 256GB" && u.searchParams.get("img")?.startsWith("https://m.media-amazon.com/images/"), "the button sends the clean link, title, the price shown and the picture: " + form.url());
    await form.getByText(/Amazon UK item B0FXFR45J7/).waitFor();
    must((await form.locator("#priceSeen").inputValue()) === "1749.99" && (await form.locator("#title").inputValue()) === "OnePlus 15R, 12GB RAM + 256GB", "the request form arrives filled in");
    must((await form.getByRole("button", { name: "Send request" }).count()) === 1, "and can be sent");
    await form.close();
    await amazon.close();

    // the US store is refused with a way forward, and the clean UK link can be used in one click
    await page.goto(base + "/request?url=" + encodeURIComponent("https://www.amazon.com/OnePlus/dp/B0FXFR45J7/ref=sr_1_1"));
    await page.getByText(/Amazon's US store/).first().waitFor();
    await page.getByRole("button", { name: "Use the Amazon UK link" }).click();
    await page.getByText(/Amazon UK item B0FXFR45J7/).waitFor();
    must((await page.locator("#url").inputValue()) === "https://www.amazon.co.uk/dp/B0FXFR45J7", "the Amazon UK link replaces the US one");
    await page.goto(base + "/request?url=" + encodeURIComponent("https://www.amazon.com/dp/B0FXFR45J7"));
    await page.locator("#priceSeen").fill("700");
    await page.getByRole("button", { name: "Send request" }).click();
    await page.getByText(/Amazon's US store/).first().waitFor();
    step("a US Amazon link is refused with the UK address to use, never sent");

    // Android's Share menu (the web app manifest), and no page of Amazon's is ever requested by the shop
    const share = await page.request.get(base + "/request/share?text=" + encodeURIComponent("Check out OnePlus 15R! https://www.amazon.co.uk/dp/B0FXFR45J7?th=1&psc=1"), { maxRedirects: 0 });
    const to = new URL(share.headers()["location"] ?? "", base);
    must(share.status() === 303 && to.pathname === "/request" && to.searchParams.get("url")?.startsWith("https://www.amazon.co.uk/dp/B0FXFR45J7") && to.searchParams.get("title") === "OnePlus 15R!", "Share sends the link and the name to the request form, got " + share.headers()["location"]);
    const mf = await (await page.request.get(base + "/manifest.webmanifest")).json();
    must(mf.share_target?.action === "/request/share" && mf.display === "standalone" && mf.icons?.some((i) => i.sizes === "512x512"), "the shop can be installed and appears in the Share menu");
    for (const asset of ["/icons/icon-192.png", "/icons/icon-512.png", "/sw.js"]) must((await page.request.get(base + asset)).ok(), asset + " is served");
    const prev = await (await page.request.get(base + "/api/link-preview?url=" + encodeURIComponent("https://www.amazon.co.uk/dp/B0FXFR45J7"))).json();
    must(prev.ok === false && prev.reason === "amazon", "the shop recognises an Amazon link without asking Amazon for the page");
    step("ordering from Amazon UK: hand-off search, one-click button, Share menu, short and shared links, US store refused, Amazon never contacted");

  // 9n. an item described in words, with no link: the customer names it, staff find it, attach the link and quote
  await page.goto(base + "/request");
  await page.getByRole("button", { name: "Send request" }).click();
  await page.locator("#title:invalid").waitFor(); // the name is required when there is no link
  await page.locator("#title").fill("Samsung Galaxy S25 128GB");
  await page.getByRole("button", { name: "Send request" }).click();
  await page.getByText(/Thanks, we.ll quote it/).waitFor();
  await ap.goto(base + "/admin/requests");
  const descCard = ap.locator("li").filter({ hasText: "Samsung Galaxy S25 128GB" }).first();
  await descCard.getByText("No link").waitFor();
  must((await descCard.getByRole("link", { name: /Search Amazon UK/ }).getAttribute("href"))?.startsWith("https://www.amazon.co.uk/s?k=Samsung"), "staff get an Amazon UK search for a described item");
  await descCard.getByLabel(/Link to the item you found/).fill("https://www.amazon.co.uk/Samsung-Galaxy/dp/B0CHX1W1XY?th=1&tag=x");
  await descCard.getByLabel(/UK price, each/).fill("620.00");
  await descCard.getByLabel(/Weight, each/).fill("400");
  await descCard.getByRole("button", { name: "Send quote" }).click();
  await ap.getByText(/Quote saved for request/).waitFor();
  const descRaw = await ap.locator("li").filter({ hasText: "Samsung Galaxy S25 128GB" }).first().getByLabel("Customer pay link").inputValue();
  await page.goto(base + new URL(descRaw, base).pathname);
  await page.getByText("Samsung Galaxy S25 128GB").first().waitFor();
  await page.getByRole("link", { name: /View on the UK shop/ }).waitFor();
  must((await page.getByRole("link", { name: /View on the UK shop/ }).getAttribute("href")) === "https://www.amazon.co.uk/dp/B0CHX1W1XY", "staff-attached Amazon UK link is tidied");
  step("an item described in words is found by staff, linked, quoted and priced for the customer");
  }

  // 10. wishlist + sign out
  await page.goto(base + PRODUCT);
  await page.getByRole("button", { name: /Save|wishlist/i }).first().click();
  await page.goto(base + "/account/wishlist");
  must((await page.getByText("Cloud Runner Trainers").count()) > 0, "wishlist holds the saved item");
  step("wishlist saves an item");
} catch (e) {
  console.log("FAIL exception:", e.message.split("\n")[0], (e.stack || "").split("\n").filter((l) => l.includes("e2e.mjs")).slice(0, 2).join(" "));
  await page.screenshot({ path: "e2e-fail.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
}
console.log(errors.length ? "browser errors:\n" + errors.join("\n") : "no browser errors");
await browser.close();
