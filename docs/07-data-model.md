# 7. Data model

All data is in **one SQLite database file** (`shop.db`, in WAL mode, foreign keys on). The schema is created in `src/lib/schema.ts` when the server starts; later additions are applied by `migrate()` in `src/lib/db.ts` (adds columns, rebuilds a table when a rule has to change). Nothing is ever dropped automatically.

Conventions:
- **Money is stored as whole numbers**: pence for pounds (`*_gbp_minor`, `price_minor`) and pesewas for cedis (`*_ghs_minor`, or `*_minor` on orders). No decimals.
- **Times** are UTC text in the form `YYYY-MM-DD HH:MM:SS`.
- **Secrets are encrypted** before they are stored (provider keys, feed addresses). Passwords and session tokens are **hashed**.

## How the tables relate

```
shops ──< products ──< cart_items >── carts
  │           │
  │           └──< wishlist_items >── customers ──< customer_addresses
  │           └──< reviews              │  ├──< customer_sessions
  └──< catalog_sources                  │  └──< password_resets
          ├──< import_items ──> products (the live product it feeds)
          └──< import_runs
orders ──< order_items            (product_id is a plain number, not linked: an order keeps its own record)
   ├──< order_events   ├──< order_tracking   ├── order_costs   └──< payments
link_requests ──> orders          (order_id once the customer has paid)
messages (the outbox)             webhook_events (payment events already applied)
settings, integration_settings, shipping_methods, delivery_zones, fx_rate_history
admin_users, audit_log
```

Important choices:
- **Orders are self-contained.** An order stores the customer's name, address, area name and fee, shipping method, every amount, and each item's name, shop name, price and weight **as they were**. Deleting a shop, product or delivery area never changes an old order.
- **A link order's items have no product.** `order_items.product_id` is empty for them; `source_url` holds the link.
- **`link_requests.order_id`** ties a request to the order it became.
- **The super admin is not in the database.** `admin_users` holds staff only.

## What each table is for

| Table | Purpose |
| --- | --- |
| `settings` | Key/value site settings: site name, exchange rate and markup, service charge rule, minimum order, support WhatsApp, theme, exchange-rate policy, automatic-quote rules, item types, notification rules. |
| `shops` | The shops shown on the site. `category` is the department. `logo_url` is an uploaded file or a link. |
| `products` | Items for sale: price, optional was-price and deal end, weight, size/colour options (JSON), photo, source link, active flag, last-synced time. |
| `carts`, `cart_items` | A visitor's cart, found by a cookie token. |
| `shipping_methods` | Shipping methods and their rate cards (JSON). |
| `delivery_zones` | Delivery areas and their fees. |
| `orders` | One row per order: status, payment status, payment reference, customer and delivery details, rate used, every amount, chargeable grams, notification choices, owning customer. |
| `order_items` | The lines of an order, as bought. |
| `order_events` | The history of an order: each status change with the note shown to the customer. |
| `order_tracking` | Tracking entries (stage, carrier, reference, link, note). |
| `order_costs` | What the order really cost (for margin). One row per order. |
| `payments` | Each payment attempt with a gateway: provider, reference, currency, amount, status. |
| `webhook_events` | Gateway events already applied, so a repeated webhook is ignored. |
| `link_requests` | Links customers sent: item, quantity, details, who sent it, status, and the quote (price, weight, note, expiry, private token, how the price was found) and the order it became. |
| `customers` | Shopper accounts: name, phone (international form), optional email, password hash, status, notification preferences, default area. |
| `customer_sessions` | Signed-in sessions (the cookie value is stored hashed). |
| `customer_identities` | Which Google, Facebook or Apple account is connected to which customer (the provider's own id, and the email it shared). |
| `oauth_states` | Sign-in attempts in progress: single use, 10 minutes, only hashes of the state and browser tie are kept. |
| `social_signups` | A first-time provider sign-in waiting for a phone number (30 minutes). |
| `customer_addresses` | Saved delivery addresses (up to 10 each). |
| `password_resets` | One-time reset links (stored hashed, valid 60 minutes). |
| `wishlist_items` | Saved items per customer. |
| `reviews` | Customer reviews (published or hidden). |
| `integration_settings` | Provider keys and switches. Secret values are encrypted. |
| `messages` | The outbox of SMS, WhatsApp and email messages: status, attempts, errors. |
| `admin_users` | Staff accounts: email, name, password hash, role, rights (JSON), status, must-change-password flag, session version, last sign-in. |
| `audit_log` | Who did what and when (actor, action, target, detail). |
| `fx_rate_history` | Every change to the exchange rate and why. |
| `catalog_sources` | Catalogue sources: kind, encrypted address, field map, schedule, rules, terms confirmation, last run result, pause time. |
| `import_items` | Everything the importer has read, with its decision (pending, published, held, rejected), fingerprint of price/stock/photo, options and the live product it feeds. |
| `import_runs` | One row per source run: counts and the message shown to you. |

## Columns

Generated from the database definition.

### settings

| Column | Type | Notes |
| --- | --- | --- |
| `key` | TEXT | primary key |
| `value` | TEXT | required |

### shops

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `slug` | TEXT | required |
| `name` | TEXT | required |
| `tagline` | TEXT | required; default '' |
| `category` | TEXT | required |
| `website_url` | TEXT | required; default '' |
| `description` | TEXT | required; default '' |
| `accent` | TEXT | required; default '#0b5d3b' |
| `logo_url` | TEXT | required; default '' |
| `notes` | TEXT | required; default '' |
| `active` | INTEGER | required; default 1 |
| `sort` | INTEGER | required; default 0 |

### products

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `shop_id` | INTEGER | required; → shops |
| `slug` | TEXT | required |
| `name` | TEXT | required |
| `brand` | TEXT | required; default '' |
| `category` | TEXT | required; default '' |
| `description` | TEXT | required; default '' |
| `price_minor` | INTEGER | required |
| `weight_grams` | INTEGER | required; default 500 |
| `options` | TEXT | required; default '[]' |
| `image_url` | TEXT |  |
| `source_url` | TEXT | required; default '' |
| `active` | INTEGER | required; default 1 |
| `created_at` | TEXT | required; default datetime('now') |
| `compare_at_minor` | INTEGER |  |
| `deal_ends_at` | TEXT |  |
| `last_synced_at` | TEXT |  |

### carts

| Column | Type | Notes |
| --- | --- | --- |
| `token` | TEXT | primary key |
| `created_at` | TEXT | required; default datetime('now') |
| `updated_at` | TEXT | required; default datetime('now') |

### cart_items

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `cart_token` | TEXT | required; → carts (on delete cascade) |
| `product_id` | INTEGER | required; → products |
| `quantity` | INTEGER | required |
| `options` | TEXT | required; default '{}' |

### shipping_methods

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `code` | TEXT | required |
| `name` | TEXT | required |
| `eta` | TEXT | required; default '' |
| `rate_card` | TEXT | required |
| `active` | INTEGER | required; default 1 |
| `sort` | INTEGER | required; default 0 |

### delivery_zones

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `name` | TEXT | required |
| `areas` | TEXT | required; default '' |
| `fee_minor` | INTEGER | required |
| `eta` | TEXT | required; default '' |
| `active` | INTEGER | required; default 1 |
| `sort` | INTEGER | required; default 0 |

### orders

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `number` | TEXT | required |
| `status` | TEXT | required |
| `payment_status` | TEXT | required |
| `payment_ref` | TEXT | required |
| `customer_name` | TEXT | required |
| `phone` | TEXT | required |
| `email` | TEXT | required; default '' |
| `zone_id` | INTEGER |  |
| `zone_name` | TEXT | required |
| `address` | TEXT | required |
| `landmark` | TEXT | required; default '' |
| `notes` | TEXT | required; default '' |
| `shipping_code` | TEXT | required |
| `shipping_name` | TEXT | required |
| `fx_rate` | REAL | required |
| `fx_markup_pct` | REAL | required |
| `items_gbp_minor` | INTEGER | required |
| `items_ghs_minor` | INTEGER | required |
| `service_fee_minor` | INTEGER | required |
| `shipping_minor` | INTEGER | required |
| `delivery_minor` | INTEGER | required |
| `total_minor` | INTEGER | required |
| `chargeable_grams` | INTEGER | required |
| `created_at` | TEXT | required; default datetime('now') |
| `notify_sms` | INTEGER | required; default 1 |
| `notify_email` | INTEGER | required; default 1 |
| `notify_whatsapp` | INTEGER | required; default 0 |
| `customer_id` | INTEGER | → customers (on delete set null) |

### order_items

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `order_id` | INTEGER | required; → orders (on delete cascade) |
| `product_id` | INTEGER |  |
| `shop_name` | TEXT | required |
| `name` | TEXT | required |
| `options` | TEXT | required; default '{}' |
| `quantity` | INTEGER | required |
| `unit_price_minor` | INTEGER | required |
| `weight_grams` | INTEGER | required |
| `line_ghs_minor` | INTEGER | required |
| `source_url` | TEXT | required; default '' |

### order_events

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `order_id` | INTEGER | required; → orders (on delete cascade) |
| `status` | TEXT | required |
| `note` | TEXT | required; default '' |
| `created_at` | TEXT | required; default datetime('now') |

### link_requests

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `url` | TEXT | required |
| `title` | TEXT | required; default '' |
| `details` | TEXT | required; default '' |
| `quantity` | INTEGER | required; default 1 |
| `price_seen` | TEXT | required; default '' |
| `name` | TEXT | required |
| `phone` | TEXT | required |
| `email` | TEXT | required; default '' |
| `status` | TEXT | required; default 'NEW' |
| `admin_note` | TEXT | required; default '' |
| `created_at` | TEXT | required; default datetime('now') |
| `token` | TEXT |  |
| `quote_price_minor` | INTEGER |  |
| `quote_weight_grams` | INTEGER |  |
| `quote_note` | TEXT | required; default '' |
| `quoted_at` | TEXT |  |
| `quote_expires_at` | TEXT |  |
| `order_id` | INTEGER |  |
| `item_type` | TEXT | required; default '' |
| `quote_source` | TEXT | required; default '' |
| `quote_basis_minor` | INTEGER |  |
| `customer_id` | INTEGER |  |

### integration_settings

| Column | Type | Notes |
| --- | --- | --- |
| `provider` | TEXT | primary key |
| `key` | TEXT | primary key |
| `value` | TEXT | required |
| `is_secret` | INTEGER | required; default 0 |
| `updated_at` | TEXT | required; default datetime('now') |

### payments

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `order_id` | INTEGER | required; → orders (on delete cascade) |
| `provider` | TEXT | required |
| `provider_ref` | TEXT | required |
| `attempt_ref` | TEXT | required |
| `status` | TEXT | required; default 'PENDING' |
| `currency` | TEXT | required |
| `amount_minor` | INTEGER | required |
| `note` | TEXT | required; default '' |
| `created_at` | TEXT | required; default datetime('now') |
| `updated_at` | TEXT | required; default datetime('now') |

### webhook_events

| Column | Type | Notes |
| --- | --- | --- |
| `provider` | TEXT | primary key |
| `event_id` | TEXT | primary key |
| `received_at` | TEXT | required; default datetime('now') |

### messages

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `order_id` | INTEGER | → orders (on delete cascade) |
| `channel` | TEXT | required |
| `provider` | TEXT | required; default '' |
| `recipient` | TEXT | required |
| `event` | TEXT | required; default '' |
| `subject` | TEXT | required; default '' |
| `body` | TEXT | required |
| `status` | TEXT | required; default 'PENDING' |
| `attempts` | INTEGER | required; default 0 |
| `error` | TEXT | required; default '' |
| `created_at` | TEXT | required; default datetime('now') |
| `sent_at` | TEXT |  |
| `payload` | TEXT | required; default '' |
| `locked_at` | TEXT |  |

### customers

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `name` | TEXT | required |
| `phone` | TEXT | required |
| `email` | TEXT |  |
| `password_hash` | TEXT | required |
| `password_set` | INTEGER | required; default 1. 0 for an account made with Google, Facebook or Apple whose password is a random one nobody knows; set to 1 when the customer chooses a password. |
| `status` | TEXT | required; default 'ACTIVE' |
| `notify_sms` | INTEGER | required; default 1 |
| `notify_email` | INTEGER | required; default 1 |
| `notify_whatsapp` | INTEGER | required; default 0 |
| `default_zone_id` | INTEGER |  |
| `created_at` | TEXT | required; default datetime('now') |
| `last_login_at` | TEXT |  |
| `updates_seen_at` | TEXT |  |

### customer_sessions

| Column | Type | Notes |
| --- | --- | --- |
| `token_hash` | TEXT | primary key |
| `customer_id` | INTEGER | required; → customers (on delete cascade) |
| `expires_at` | TEXT | required |
| `created_at` | TEXT | required; default datetime('now') |
| `user_agent` | TEXT | required; default '' |

### customer_identities

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `customer_id` | INTEGER | required; → customers (on delete cascade) |
| `provider` | TEXT | required; google, facebook or apple |
| `subject` | TEXT | required; the provider's own id for the person. Unique with provider. |
| `email` | TEXT | required; default ''. The email the provider shared. |
| `created_at` | TEXT | required; default datetime('now') |

### oauth_states

| Column | Type | Notes |
| --- | --- | --- |
| `state_hash` | TEXT | primary key (hash of the state sent to the provider) |
| `provider` | TEXT | required |
| `binding_hash` | TEXT | required (hash of the cookie value that ties the attempt to one browser) |
| `nonce` | TEXT | required |
| `verifier` | TEXT | required (PKCE verifier, Google) |
| `next_path` | TEXT | required; default '/account' |
| `link_customer_id` | INTEGER | set when a signed-in customer is connecting a provider |
| `expires_at` | TEXT | required |

### social_signups

| Column | Type | Notes |
| --- | --- | --- |
| `token_hash` | TEXT | primary key (hash of the cookie value) |
| `provider`, `subject` | TEXT | required |
| `name`, `email` | TEXT | required; default '' |
| `email_verified` | INTEGER | required; default 0 |
| `next_path` | TEXT | required; default '/account' |
| `expires_at` | TEXT | required |

### customer_addresses

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `customer_id` | INTEGER | required; → customers (on delete cascade) |
| `label` | TEXT | required |
| `recipient` | TEXT | required |
| `phone` | TEXT | required |
| `zone_id` | INTEGER |  |
| `address` | TEXT | required |
| `landmark` | TEXT | required; default '' |
| `is_default` | INTEGER | required; default 0 |

### password_resets

| Column | Type | Notes |
| --- | --- | --- |
| `token_hash` | TEXT | primary key |
| `customer_id` | INTEGER | required; → customers (on delete cascade) |
| `expires_at` | TEXT | required |
| `used_at` | TEXT |  |

### wishlist_items

| Column | Type | Notes |
| --- | --- | --- |
| `customer_id` | INTEGER | primary key; → customers (on delete cascade) |
| `product_id` | INTEGER | primary key; → products (on delete cascade) |
| `created_at` | TEXT | required; default datetime('now') |

### reviews

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `product_id` | INTEGER | required; → products (on delete cascade) |
| `customer_id` | INTEGER | → customers (on delete set null) |
| `author` | TEXT | required |
| `rating` | INTEGER | required |
| `title` | TEXT | required; default '' |
| `body` | TEXT | required; default '' |
| `status` | TEXT | required; default 'PUBLISHED' |
| `created_at` | TEXT | required; default datetime('now') |

### admin_users

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `email` | TEXT | required |
| `name` | TEXT | required |
| `password_hash` | TEXT | required |
| `role` | TEXT | required; default 'custom' |
| `permissions` | TEXT | required; default '[]' |
| `status` | TEXT | required; default 'ACTIVE' |
| `must_change_password` | INTEGER | required; default 1 |
| `session_version` | INTEGER | required; default 1 |
| `created_by` | TEXT | required; default '' |
| `created_at` | TEXT | required; default datetime('now') |
| `last_login_at` | TEXT |  |

### audit_log

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `at` | TEXT | required; default datetime('now') |
| `actor` | TEXT | required |
| `action` | TEXT | required |
| `target` | TEXT | required; default '' |
| `detail` | TEXT | required; default '' |

### fx_rate_history

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `rate` | REAL | required |
| `markup_pct` | REAL | required |
| `note` | TEXT | required; default '' |
| `changed_at` | TEXT | required; default datetime('now') |

### order_costs

| Column | Type | Notes |
| --- | --- | --- |
| `order_id` | INTEGER | primary key; → orders (on delete cascade) |
| `retailer_gbp_minor` | INTEGER | required; default 0 |
| `uk_delivery_gbp_minor` | INTEGER | required; default 0 |
| `purchase_rate` | REAL | required; default 0 |
| `freight_ghs_minor` | INTEGER | required; default 0 |
| `local_delivery_ghs_minor` | INTEGER | required; default 0 |
| `payment_fees_ghs_minor` | INTEGER | required; default 0 |
| `other_ghs_minor` | INTEGER | required; default 0 |
| `note` | TEXT | required; default '' |
| `updated_at` | TEXT | required; default datetime('now') |

### order_tracking

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `order_id` | INTEGER | required; → orders (on delete cascade) |
| `stage` | TEXT | required |
| `carrier` | TEXT | required; default '' |
| `reference` | TEXT | required; default '' |
| `url` | TEXT | required; default '' |
| `note` | TEXT | required; default '' |
| `created_at` | TEXT | required; default datetime('now') |

### catalog_sources

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `shop_id` | INTEGER | required; → shops (on delete cascade) |
| `name` | TEXT | required |
| `kind` | TEXT | required |
| `url` | TEXT | required; default '' |
| `field_map` | TEXT | required; default '{}' |
| `terms_url` | TEXT | required; default '' |
| `terms_note` | TEXT | required; default '' |
| `terms_confirmed_at` | TEXT |  |
| `enabled` | INTEGER | required; default 0 |
| `auto_publish_new` | INTEGER | required; default 1 |
| `auto_apply_updates` | INTEGER | required; default 1 |
| `max_price_change_pct` | INTEGER | required; default 40 |
| `max_items` | INTEGER | required; default 50 |
| `delay_ms` | INTEGER | required; default 3000 |
| `interval_hours` | INTEGER | required; default 24 |
| `stale_days` | INTEGER | required; default 14 |
| `default_category` | TEXT | required; default '' |
| `default_weight_grams` | INTEGER | required; default 500 |
| `last_run_at` | TEXT |  |
| `last_status` | TEXT | required; default '' |
| `last_message` | TEXT | required; default '' |
| `paused_until` | TEXT |  |
| `running_since` | TEXT |  |
| `created_at` | TEXT | required; default datetime('now') |

### import_items

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `source_id` | INTEGER | required; → catalog_sources (on delete cascade) |
| `external_id` | TEXT | required |
| `product_url` | TEXT | required; default '' |
| `name` | TEXT | required |
| `brand` | TEXT | required; default '' |
| `category` | TEXT | required; default '' |
| `description` | TEXT | required; default '' |
| `price_minor` | INTEGER | required |
| `compare_at_minor` | INTEGER |  |
| `image_url` | TEXT | required; default '' |
| `in_stock` | INTEGER | required; default 1 |
| `weight_grams` | INTEGER |  |
| `options` | TEXT | required; default '[]' |
| `fingerprint` | TEXT | required; default '' |
| `status` | TEXT | required; default 'PENDING' |
| `hold_reason` | TEXT | required; default '' |
| `product_id` | INTEGER | → products (on delete set null) |
| `first_seen_at` | TEXT | required; default datetime('now') |
| `last_seen_at` | TEXT | required; default datetime('now') |

### import_runs

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | primary key |
| `source_id` | INTEGER | required; → catalog_sources (on delete cascade) |
| `started_at` | TEXT | required; default datetime('now') |
| `finished_at` | TEXT |  |
| `status` | TEXT | required; default 'RUNNING' |
| `fetched` | INTEGER | required; default 0 |
| `created` | INTEGER | required; default 0 |
| `updated` | INTEGER | required; default 0 |
| `held` | INTEGER | required; default 0 |
| `skipped` | INTEGER | required; default 0 |
| `removed` | INTEGER | required; default 0 |
| `message` | TEXT | required; default '' |

