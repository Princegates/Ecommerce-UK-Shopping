# 6. Architecture

## Technology

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16** (App Router) with **React 19** and **TypeScript** |
| Styling | **Tailwind CSS 4**, with the shop's own component classes in `src/app/globals.css` and colour themes set as CSS variables |
| Database | **SQLite** through `better-sqlite3` (synchronous, one file, WAL mode) |
| Validation | **zod** |
| Payments | Stripe SDK, plus direct calls for Paystack and Flutterwave |
| Tests | **Vitest** (unit and database tests) and **Playwright** (end-to-end browser run in `e2e/`, started with `npm run e2e`) |
| Fonts | Figtree and Bricolage Grotesque (bundled, no external requests) |

The app is built as a **standalone server** (`output: "standalone"`) and shipped as a Docker image.

> `AGENTS.md` at the repository root warns that this Next.js version has breaking changes from older ones. Read the guides in `node_modules/next/dist/docs/` before changing framework-level code.

## Folder map

```
src/
  app/
    (site)/            customer pages: home, shops, product, cart, checkout, pay, order, account, quote, request, track, login…
    admin/             admin: login, server actions, export route
      (panel)/         every signed-in admin page (dashboard, orders, customers, requests, shops, items, sources, import, reviews,
                       pricing, shipping, zones, appearance, integrations, messages, audit, users, account, no-access)
    api/               cart summary, products, suggest, link-preview, health, cron/*, webhooks/[provider]
    actions/           customer server actions (account, cart, checkout, request, track, reviews, wishlist, delivery)
    uploads/[name]/    serves uploaded photos and logos
    robots.ts, layout.tsx, globals.css
  components/          shared UI (storefront in the folder root and shop/, account/, admin/)
  lib/                 all the logic (see below)
    ingest/            catalogue importer: network safety, parsers, sources, run engine, scheduler
    payments/          gateway adapters and payment confirmation
    notify/            message templates, senders and the outbox
  instrumentation.ts   starts the catalogue scheduler when the server starts
docs/                  this documentation
```

## The main modules in `src/lib`

| Module | Responsibility |
| --- | --- |
| `schema.ts`, `db.ts`, `seed.ts` | Database definition, opening, migrations, first-run data. |
| `pricing.ts` | **Pure** price calculation (no I/O) used by the product page, cart, checkout and order creation. |
| `money.ts`, `fx.ts`, `fx-api.ts` | Formatting and parsing of money; the exchange rate and its optional market feed. |
| `settings.ts` | Reads and writes site settings. |
| `catalog.ts`, `browse.ts` | Shops, products, departments, search and filtering. |
| `cart.ts` | Cart token cookie and cart lines. |
| `orders.ts`, `order-status.ts` | Quoting and creating orders, statuses and who may move them, tracking. |
| `link-orders.ts`, `link-auto.ts`, `link-submit.ts` | Link requests, quotes, automatic quoting, item types, and paying for a quote. |
| `customers.ts`, `customer-session.ts`, `password.ts` | Shopper accounts, sessions, password hashing (scrypt). |
| `admin-users.ts`, `permissions.ts`, `auth.ts` | Staff accounts, rights and roles, admin sessions and the access checks. |
| `audit.ts`, `analytics.ts`, `margin.ts` | Activity log, dashboard figures and attention list, order margin. |
| `integrations.ts`, `secrets.ts` | Provider registry and encrypted key storage. |
| `payments/*` | One adapter per gateway; webhooks and the return page are confirmed here. |
| `notify/*` | Message wording, providers and the retrying outbox. |
| `ingest/*` | The catalogue importer (below). |
| `uploads.ts` | Photo and logo storage with file-type checks. |
| `themes.ts`, `department-icons.ts` | 15 colour themes; department icons. |
| `throttle.ts`, `cron-auth.ts`, `app-url.ts` | Rate limits, cron protection, the public address. |

## How a request flows

- **Pages** are **server components**. They read the database directly (it is local and synchronous) and render per request (`dynamic = "force-dynamic"`), so prices and stock are always current. Interactive bits (cart drawer, search suggestions, checkout form, link finder) are small client components.
- **Changes** go through **server actions** (`"use server"`). A customer action checks the shopper's session; an admin action calls `requirePermission(...)` first. Actions validate input with zod, call the `lib` function, then redirect with a `?saved=1` or `?error=…` message.
- **Route handlers** serve things that are not pages: the payment return, webhooks, cron endpoints, the health check, search suggestions, link previews, uploaded files and the orders CSV.
- **Money rule:** the browser never decides a price. The server recomputes every amount from live data when an order is created, and checks the amount again with the gateway before marking it paid.

## An order, end to end

1. **Cart** (`cart_items`, tied to a cookie) is priced by `quoteCart` using live settings.
2. **Checkout** (`placeOrderAction`) requires a signed-in customer, validates the details, and `createOrder` writes `orders`, `order_items` and the first `order_events` row inside one transaction, with status *Awaiting payment*.
3. The customer is sent to **`/pay/<payment reference>`** and chooses a gateway. The gateway creates a hosted checkout and records a `payments` row.
4. The gateway returns the customer to **`/pay/<ref>/return`** and also calls **`/api/webhooks/<provider>`**. Both end in `applyOutcome`, which checks the **amount and currency**, applies each event **once** (`webhook_events`) and calls `markPaid`.
5. `markPaid` sets *Payment received* and queues messages in the **outbox**.
6. Staff move the order forward; each change writes `order_events` and may queue messages.

A **link order** differs only at the start: a `link_requests` row and a quote create the order through `placeLinkOrder`, which uses the same `createOrder`.

## The catalogue importer (`src/lib/ingest`)

```
source (catalog_sources) ─► gather items ─► stage each item (import_items) ─► publish / update / hold ─► products
        ▲ scheduler (every 10 min) or "Run now"        │ checks: price range, name, link, price-move limit
```
- `net.ts`: **the only way the importer touches the network.** Validates addresses (http/https, ports 80/443, no credentials, no private hosts), resolves names safely, follows at most three redirects (re-checked each time), obeys `robots.txt`, waits between requests, and treats 401/403/429/451 or a challenge page as **stop**.
- `parse.ts`: price parsing (pounds only), feed column mapping, sitemap and product-page reading (JSON-LD, then Open Graph), title tidying.
- `ebay.ts`, `shopify.ts`, `woocommerce.ts`: the API-style sources.
- `run.ts`: staging, publishing, the price-move guard, removal rules, stale sweep, file import, link import, previews.
- `store.ts`: sources and their settings, with encrypted addresses.
- `scheduler.ts`: the in-process timer, started from `instrumentation.ts`.

## Background work

There is no separate worker. Two timers live in the server process: the **catalogue scheduler** and the **message outbox** (which is also kicked right after an event and can be driven by `/api/cron/messages`). This is why **only one instance** may run.

## Access control in the code

- `auth.ts` reads the signed session cookie once per request (`getAdmin`) and returns who is acting: the super admin, or a staff account whose status and session version are checked **against the database every time**.
- `requireAdmin()` signs people in; `requirePermission("<right>")` also checks the right and redirects to **No access**; `requireSuper()` is for staff management only.
- A test (`admin-guards.test.ts`) scans the source and fails if any admin page or action lacks a check. See [Security](08-security.md).

## Design decisions worth knowing

- **SQLite, not a hosted database:** simplest to run and back up for one shop; the cost is the single-instance rule.
- **Pure pricing module:** the same code prices everywhere, so what customers see is what they pay.
- **Orders are snapshots:** old orders never change when settings or catalogue change.
- **The importer refuses to evade blocks:** by design, so the business is never built on circumventing a shop's protections.
- **Rights are explicit and checked per action,** not just hidden in the menu.
