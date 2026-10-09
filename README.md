# SHOP UK FROM GH: UK shops to Ghana

A storefront where Ghanaian shoppers browse listed UK shops, add items to a cart here and pay once in
cedis. You buy from the UK retailer, ship to Ghana, and a courier delivers. The customer's total is:

    items (at the UK price, converted at your rate) + service charge + shipping to Ghana + delivery in Ghana

You set the exchange rate, markup, service charge, shipping rate cards and delivery areas in the admin.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 and SQLite (better-sqlite3).

## Documentation

Full documentation is in [`docs/`](docs/README.md): an overview, the **admin guide** (every page, daily routine, link orders, staff accounts), a **customer guide**, catalogue sources, deployment and operations, architecture, the data model, security and privacy, integrations, testing, an FAQ, the change history and the formal [Software Requirements Specification](docs/13-srs.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000, admin at /admin (developer sign-in: /admin/login?developer=1, dev password: admin)
```

On first start the database is created with the settings, shipping rates, delivery areas and one shop, **eBay UK**.
Nothing fictional is created. Fill the shop with real listings from a Catalogue source (see below). For local
development only, `SEED_SAMPLE_DATA=true` adds made-up sample shops and products.

```bash
npm run lint && npm run typecheck && npm test   # checks
npm run e2e                                     # browser checks of the whole shop (see e2e/README.md)
npm run build && npm start                      # production
```

## What is in it

**Storefront:** home with deals, departments, shop pages, search with suggestions and filters, product pages
with reviews and a live "what it costs to your door" panel, cart drawer, wishlist, recently viewed, delivery
area picker, link-request form for items not listed, order lookup.

**Accounts:** register and sign in, saved addresses, profile, order history, per-order tracking (retailer,
UK address, international and courier stages), an updates feed, wishlist, verified-purchase reviews,
password reset, account deletion. Checkout requires an account.

**Payments:** Stripe, Paystack and Flutterwave. Amounts and currency are verified against the gateway,
webhooks are signed and idempotent, and card data never touches this server.

**Messages:** order updates by SMS (Arkesel, Twilio), WhatsApp (Meta Cloud API, Twilio) and email (Resend,
Postmark) through a retrying outbox, with per-status rules and per-order customer preferences.

**Catalogue feeding (Admin > Catalogue sources):** shops and products fill themselves in. Each source runs on its own
schedule from a built-in scheduler, publishes new items automatically, keeps prices, was-prices and stock current, and hides items
that go stale. See [Catalogue sources](#catalogue-sources) below.

**Themes (Admin > Appearance):** 15 colour themes, applied to the whole shop at once. Ghana green and gold is the default.

**Customer sign-in:** besides phone or email and a password, customers can sign in with **Google, Facebook or Apple**. You register an app with each (Admin > Integrations > Customer sign-in shows the redirect address to give them); the buttons show once a provider is set up and `APP_URL` is https. A first-time person adds a phone number; accounts are matched only by the provider's id or an email the provider has verified. See [Integrations](docs/09-integrations.md).

**Exchange rate:** set by you. An optional feed (ExchangeRate-API, Open Exchange Rates) can suggest or apply
rates inside guardrails; your markup always applies on top.

**Admin** (`/admin`): dashboard with sales, margin and attention list; orders and status changes; customers;
link requests; shops, items and deals; reviews moderation; pricing, shipping and delivery areas;
integrations (keys are encrypted and shown masked); message log; activity log; CSV export.

## Catalogue sources

A source is one place we are allowed to read a shop's products from. Add them in **Admin > Catalogue sources**:

| Type | Use it for | Notes |
| --- | --- | --- |
| Product feed (CSV or JSON) | Official and affiliate feeds | Most reliable. Columns are recognised automatically; override them with lines like `price=cost.gbp`. |
| Shop website (sitemap + product pages) | Shops whose terms and robots.txt allow it | Reads the sitemap, then product pages one at a time using the product data (JSON-LD or Open Graph) each page publishes. |
| eBay (official API) | Real UK listings with photos | Free developer keys (Admin > Integrations > Catalogue APIs), then list your searches. Only new, fixed-price, UK-located listings priced in pounds. |
| WooCommerce shop | Small UK shops on WooCommerce | Paste the shop address. Reads its public product list (photos, prices, stock, sizes and colours) only if its robots.txt allows it and it prices in pounds; stops at the first refusal. Get the owner's agreement first. Products sold on another website, or whose sizes cost different amounts, are skipped. |
| Diffbot (Product API) | Pages you list yourself | Paid. Save your Diffbot token under Admin > Integrations > Catalogue APIs, then list product page addresses, one per line. Diffbot reads each page and returns name, price, was-price, stock and photo. Uses a credit per product on every run. The shop's `robots.txt` is checked first and the shop's own terms still apply. |
| Shopify shop | Small UK brands on Shopify | Paste the shop address. Reads its public product list (photos, prices, stock, sizes and colours) only if its robots.txt allows it and it prices in pounds; stops at the first refusal. Get the owner's agreement first. Products whose sizes cost different amounts are skipped. |
| File import (CSV or JSON) | Data you collected yourself, for example a spreadsheet or an export from a tool such as Octoparse | Create the source, then upload the file on its page. Nothing is fetched from any shop. Prices must be in pounds. Re-uploading updates prices and stock; a file never removes products. Only upload data you are allowed to use. |
| Pasted links | One-off items | Paste up to 20 product links. Prices are re-checked automatically. |

**What runs by itself:** new items go live, price, was-price and stock changes update live items, items that disappear from a
feed (or go out of stock) are hidden, and anything not refreshed within the source's "stale" window is hidden so an old price
never stays on sale. A price move bigger than the source's limit (40% by default), or an implausible price, waits in **Import
review** instead.

**Rules the importer follows, and will not break:**
- A source cannot be switched on until you confirm you have checked the shop's terms or hold a licence for the feed.
- It identifies itself as `ShopCatalogBot` with this site's address in its user agent, obeys `robots.txt` and any `Crawl-delay`, and waits
  at least two seconds between page requests.
- It never reaches private or internal addresses, and feed addresses (which often carry keys) are stored encrypted.
- When a shop answers 401, 403, 429 or shows a verification page, it **stops**, pauses that source for 24 hours and tells you.
  It does not retry with another identity, rotate addresses or try to get past CAPTCHAs or blocks. Use the shop's official feed or add
  items by hand for shops that refuse automated reading.
- Only prices in pounds are accepted. Images are linked from the source, so confirm your licence covers that.

The scheduler runs inside the server every ten minutes. To run it from your own scheduler instead, set `INGEST_AUTORUN=false` and call
`/api/cron/ingest`. On the **Request any item** page, a shopper's pasted link is looked up the same way (obeying robots.txt)
to fill in the name and price, or to point them at the item if it is already listed.

### Admin roles and access

There are two kinds of admin sign-in:

- **Super admin**: the developer's `ADMIN_PASSWORD`, used at `/admin/login?developer=1`. It can do everything and is the only way to manage staff. It is not stored in the
  database and cannot be edited or switched off from the admin, so keep the password to yourself.
- **Staff accounts**: created by the super admin under **Admin > Staff accounts**. Each person signs in at `/admin/login` with their email. Pick a role (Manager,
  Operations, Customer support, Catalogue editor, Finance, Read-only) or tick exactly the rights they need. A new account has a first password set by the super
  admin and must choose its own before anything else opens. The super admin can change a person's access, reset their password, switch them off (which signs them out
  at once) or delete them. Staff cannot create or change accounts, and cannot give themselves more access.

Every admin page and action checks a specific right, the menu shows only what a person can open, and the activity log records who did what. A test fails if a new admin page or
action forgets its check.

### Link orders

Items from shops you do not list (Amazon, Argos and so on) are handled as **link orders**, so they are captured by the system like any other order:

1. The shopper sends a link (home page box, header button, search box or `/request`). If they are signed in it is attached to their account.
2. In **Admin > Link requests** you check the item on the shop and **send a quote**: the UK price of one item and its weight. The shopper is messaged
   a private pay link (and you can copy the link yourself). The price is held for the number of days you choose.
3. The shopper opens the link, sees the full cost in cedis, chooses delivery and pays through the normal checkout.
4. It is now an ordinary order (statuses, tracking, messages, refunds), linked back to the request. Expired or repeated quotes cannot be ordered twice.

**Automatic quotes** (Admin > Link requests > Automatic quotes) let the system fill in the UK price and weight so the shopper can pay at once. The cost
to the customer always comes from your own exchange rate, service charge, shipping rates and delivery fee. By default the system only quotes by itself when
it read the price from the shop's own web page. You can also let it use the price the shopper typed (with a safety margin you set), set a limit above which
a person must quote, and edit the item types and default weights shoppers choose from. Link orders show a banner on the order page, saying how the price was
found, as a reminder to check the shop's price before buying.

**Amazon UK.** Amazon forbids automated reading of its pages, and its official product data needs an approved Associates account, so the shop does not list Amazon products. Customers instead search on Amazon UK
(the search page links there), then send the item back by pasting the link, the phone's Share menu (the site is an installable app) or a bookmarklet from `/amazon`. Links are cleaned to `amazon.co.uk/dp/ASIN`;
other Amazon stores are refused; the price is the customer's guide and staff verify it before buying.

## Configuration

Copy `.env.example` to `.env.local`. In production set at least `ADMIN_PASSWORD`, `ADMIN_SECRET`
(16+ characters), `APP_URL` and `CRON_SECRET`, and point `DATABASE_PATH` at a persistent disk. Provider keys
can be set as environment variables or in **Admin > Integrations**.

### Webhooks and scheduled jobs

| What | URL |
| --- | --- |
| Stripe webhook | `{APP_URL}/api/webhooks/stripe` |
| Paystack webhook | `{APP_URL}/api/webhooks/paystack` |
| Flutterwave webhook | `{APP_URL}/api/webhooks/flutterwave` |
| Retry queued messages | `GET {APP_URL}/api/cron/messages` every few minutes |
| Sync market exchange rate | `GET {APP_URL}/api/cron/fx` hourly or daily |
| Run due catalogue sources | `GET {APP_URL}/api/cron/ingest` (only if `INGEST_AUTORUN=false`) |

Send `Authorization: Bearer $CRON_SECRET` to the cron endpoints. Each integration card in the admin
shows the exact webhook URL and the events to enable.

## Deploying

See [DEPLOY.md](DEPLOY.md): a Dockerfile, a Docker Compose setup with automatic HTTPS, and ready configs for Fly.io and Render.
The shop needs one always-on server with a persistent disk (it uses a SQLite file), so serverless hosts will not work.

## Before you go live

- **The provider integrations are covered by unit tests with mocked responses only.** Test each one in the
  provider's sandbox with the admin "Test" button and a real payment before taking live orders.
- Check each UK retailer's terms before pointing a source at it, and do not bypass bot protection. Major retailers generally forbid
  scraping and block it; use their affiliate or product feeds, or add items by hand.
- Automatic publishing means a bad feed can put a wrong price on the site. Keep the price-move limit on, and look at the Import review
  queue and each source's run history now and then.
- Phone and email are not verified at sign-up. Add OTP verification before relying on them for security.
- Rate limits are in memory and per instance; use a shared store if you run several instances.
- Get legal and tax advice on customs duty, VAT, consumer terms and any payment licensing that applies to you.
