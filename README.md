# Akwaaba UK: UK shops to Ghana

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

On first start the database is created and filled with **fictional sample shops and products**. Replace
them in the admin before going live. Nothing shown is a real retailer listing or price.

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

**Exchange rate:** set by you. An optional feed (ExchangeRate-API, Open Exchange Rates) can suggest or apply
rates inside guardrails; your markup always applies on top.

**Admin** (`/admin`): dashboard with sales, margin and attention list; orders and status changes; customers;
link requests; shops, items and deals; reviews moderation; pricing, shipping and delivery areas;
integrations (keys are encrypted and shown masked); message log; activity log; CSV export.

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

Send `Authorization: Bearer $CRON_SECRET` to the two cron endpoints. Each integration card in the admin
shows the exact webhook URL and the events to enable.

## Before you go live

- **The provider integrations are covered by unit tests with mocked responses only.** Test each one in the
  provider's sandbox with the admin "Test" button and a real payment before taking live orders.
- Check each UK retailer's terms before listing it, and do not bypass bot protection. Add products by hand,
  from an affiliate or product feed you are licensed to use, or from orders customers request by link.
- Phone and email are not verified at sign-up. Add OTP verification before relying on them for security.
- Rate limits are in memory and per instance; use a shared store if you run several instances.
- Get legal and tax advice on customs duty, VAT, consumer terms and any payment licensing that applies to you.
