# 10. Testing

The system has two layers of automated checks, plus manual checks you should do on the live site. At the time of writing: **321 unit and database tests in 41 files**, and **40 end-to-end browser steps**.

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Runs all unit and database tests once (Vitest). Takes about 15 seconds. |
| `npm run test:watch` | Re-runs tests as you edit. |
| `npm run lint` | Code style and common mistakes (ESLint). |
| `npm run typecheck` | TypeScript type check. |
| `npm run build` | Production build (also type-checks pages). |
| `npm run e2e` | Builds the shop, starts it on a throwaway database, drives a real browser through everything, and stops it. See [`e2e/README.md`](../e2e/README.md). |

**Before every release run:** `npm run lint && npm run typecheck && npm test && npm run e2e`.

## Layer 1: unit and database tests

Tests live next to the code they check (`src/lib/*.test.ts`, `src/lib/ingest/*.test.ts`, `src/lib/notify/*.test.ts`, `src/lib/payments/*.test.ts`). Database tests use a **fresh in-memory database** with the real schema (`openForTest()`), so they exercise the real SQL without touching any real data. They run in isolation and can run in any order.

| Area | What is checked |
| --- | --- |
| **Pricing** | Service charge modes, rate cards and brackets, rounding, exchange rate and markup, chargeable weight, full order totals. |
| **Orders** | Quote and creation, minimum order, payment confirmed once, tracking by number plus contact, legal status steps only, refunds. |
| **Payments** | Gateway adapters, webhook signatures, amount and currency matching, events applied once. |
| **Messages** | Wording for every status, per-status rules, customer preferences, retries, phone and email handling. |
| **Customers** | Registration, sign-in, sessions, password reset, addresses, wishlist, account deletion. |
| **Admin and staff** | Staff accounts, password rules, session cut-off when switched off or changed, rights and role presets, session tokens (tamper and expiry), the **guard test** below. |
| **Catalogue importer** | Network safety (private addresses, redirects), `robots.txt` rules, price and feed parsing, feed field mapping, publishing, price-move guard, removal rules, eBay, Shopify, file import, source-kind migrations. |
| **Link orders** | Quotes, expiry, one order per quote, automatic-quote rules, margin arithmetic, item types, one-click submit. |
| **Catalogue and shops** | Deleting shops and delivery areas, shop logos, department icons, themes, seeding and cleanup, search and filters. |
| **Security helpers** | Encryption of saved keys, uploads (file types, size), throttling, cron protection. |

### The guard test (`src/lib/admin-guards.test.ts`)
It reads the source and **fails if any admin page or admin action lacks an access check**, if staff management is not super-admin-only, or if the orders download does not check its right. When you add a new admin page or action, it must call `requirePermission("…")` (or `requireSuper()` / `requireAdmin()` where appropriate) or the test fails.

## Layer 2: end-to-end browser run

`e2e/e2e.mjs` uses a real headless Chromium and checks, in order: protected pages and unsigned webhooks refused; search; adding to cart; sign-up; checkout and payment; account and tracking; admin sign-in; every admin page loads; order status changes; exchange rate and pricing changes; catalogue sources (permission, internal addresses refused, create and remove, eBay and Shopify forms, file import); shops (logo upload, delete) and delivery areas (add, delete); themes; photo uploads (including refusing a fake image); the Add-by-link button and the home-page link box; link requests, quotes, payment and automatic quotes; one-click found-link flow; **staff accounts** (create, forced password change, limited menu, "No access", no change buttons, no export, switch off signs out); phone layouts for the admin and the shop; wishlist.

It fails if the browser console shows errors.

## What is deliberately *not* tested automatically

- **Real shops and real payments.** The test environment cannot reach retailer sites or payment gateways. Reading a real page, a real gateway checkout and real SMS/WhatsApp/email delivery must be checked by hand on the live site.
- **Real phones.** Phone layouts are checked in an emulated phone in Chromium, not on iPhone Safari or specific Android browsers.
- **Load.** There is no load test; the system is built for one small shop.

## Manual checklist before announcing the shop

1. `/api/health` answers `{"ok":true}`.
2. Sign in as the super admin and as a test staff account; confirm the staff menu is limited.
3. Place a **small real order** with a **real payment** through each gateway you switched on; confirm the order becomes *Payment received* and the customer message arrives.
4. Move that order through every status and check the customer sees each step and message.
5. Cancel and refund a test order and mark it **Refunded**.
6. Paste a real product link on the home page; confirm the price shown matches the shop; send a link request you must quote by hand and complete it.
7. Run a catalogue source and check items, photos and prices against the shop.
8. Open the site and the admin on a real phone (iPhone and Android if you can).
9. Make a backup and **restore it** on a copy.

## Adding tests

- Logic goes in `src/lib` with a `*.test.ts` beside it. Use `openForTest()` for anything that touches the database.
- Anything that handles money, access or the network needs tests before it is changed.
- A bug fix should start with a test that fails because of the bug.
