# SHOP UK FROM GH: UK shops to Ghana

A storefront where Ghanaian shoppers browse listed UK shops, add items to a cart here and pay once in
cedis. You buy from the UK retailer, ship to Ghana, and a courier delivers. The customer's total is:

    items (at the UK price, converted at your rate) + service charge + shipping to Ghana + delivery in Ghana

You set the exchange rate, markup, service charge, shipping rate cards and delivery areas in the admin.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 and SQLite (better-sqlite3).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000, admin at /admin (dev password: admin)
```

On first start the database is created with the settings, shipping rates, delivery areas and one shop, **eBay UK**.
Nothing fictional is created. Fill the shop with real listings from a Catalogue source (see below). For local
development only, `SEED_SAMPLE_DATA=true` adds made-up sample shops and products.

```bash
npm run lint && npm run typecheck && npm test   # checks
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
| Shopify shop | Small UK brands on Shopify | Paste the shop address. Reads its public product list (photos, prices, stock, sizes and colours) only if its robots.txt allows it and it prices in pounds; stops at the first refusal. Get the owner's agreement first. Products whose sizes cost different amounts are skipped. |
| Pasted links | One-off items | Paste up to 20 product links. Prices are re-checked automatically. |

**What runs by itself:** new items go live, price, was-price and stock changes update live items, items that disappear from a
feed (or go out of stock) are hidden, and anything not refreshed within the source's "stale" window is hidden so an old price
never stays on sale. A price move bigger than the source's limit (40% by default), or an implausible price, waits in **Import
review** instead.

**Rules the importer follows, and will not break:**
- A source cannot be switched on until you confirm you have checked the shop's terms or hold a licence for the feed.
- It identifies itself as `ShopCatalogBot` with a page shops can read (`/bot`), obeys `robots.txt` and any `Crawl-delay`, and waits
  at least two seconds between page requests.
- It never reaches private or internal addresses, and feed addresses (which often carry keys) are stored encrypted.
- When a shop answers 401, 403, 429 or shows a verification page, it **stops**, pauses that source for 24 hours and tells you.
  It does not retry with another identity, rotate addresses or try to get past CAPTCHAs or blocks. Use the shop's official feed or add
  items by hand for shops that refuse automated reading.
- Only prices in pounds are accepted. Images are linked from the source, so confirm your licence covers that.

The scheduler runs inside the server every ten minutes. To run it from your own scheduler instead, set `INGEST_AUTORUN=false` and call
`/api/cron/ingest`. On the **Request an item by link** page, a shopper's pasted link is looked up the same way (obeying robots.txt)
to fill in the name and price, or to point them at the item if it is already listed.

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
