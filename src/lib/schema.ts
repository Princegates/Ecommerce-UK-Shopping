export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shops (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  tagline     TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL,
  website_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  accent      TEXT NOT NULL DEFAULT '#0b5d3b',
  logo_url    TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id           INTEGER PRIMARY KEY,
  shop_id      INTEGER NOT NULL REFERENCES shops(id),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  brand        TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  price_minor  INTEGER NOT NULL CHECK (price_minor >= 0),
  weight_grams INTEGER NOT NULL DEFAULT 500 CHECK (weight_grams >= 0),
  options      TEXT NOT NULL DEFAULT '[]',
  image_url    TEXT,
  source_url   TEXT NOT NULL DEFAULT '',
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS products_shop_idx ON products (shop_id);

CREATE TABLE IF NOT EXISTS carts (
  token      TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         INTEGER PRIMARY KEY,
  cart_token TEXT NOT NULL REFERENCES carts(token) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  options    TEXT NOT NULL DEFAULT '{}',
  UNIQUE (cart_token, product_id, options)
);

CREATE TABLE IF NOT EXISTS shipping_methods (
  id        INTEGER PRIMARY KEY,
  code      TEXT NOT NULL UNIQUE,
  name      TEXT NOT NULL,
  eta       TEXT NOT NULL DEFAULT '',
  rate_card TEXT NOT NULL,
  active    INTEGER NOT NULL DEFAULT 1,
  sort      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS delivery_zones (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  areas     TEXT NOT NULL DEFAULT '',
  fee_minor INTEGER NOT NULL CHECK (fee_minor >= 0),
  eta       TEXT NOT NULL DEFAULT '',
  active    INTEGER NOT NULL DEFAULT 1,
  sort      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id                   INTEGER PRIMARY KEY,
  number               TEXT NOT NULL UNIQUE,
  status               TEXT NOT NULL,
  payment_status       TEXT NOT NULL,
  payment_ref          TEXT NOT NULL UNIQUE,
  customer_name        TEXT NOT NULL,
  phone                TEXT NOT NULL,
  email                TEXT NOT NULL DEFAULT '',
  zone_id              INTEGER,
  zone_name            TEXT NOT NULL,
  address              TEXT NOT NULL,
  landmark             TEXT NOT NULL DEFAULT '',
  notes                TEXT NOT NULL DEFAULT '',
  shipping_code        TEXT NOT NULL,
  shipping_name        TEXT NOT NULL,
  fx_rate              REAL NOT NULL,
  fx_markup_pct        REAL NOT NULL,
  items_gbp_minor      INTEGER NOT NULL,
  items_ghs_minor      INTEGER NOT NULL,
  service_fee_minor    INTEGER NOT NULL,
  shipping_minor       INTEGER NOT NULL,
  delivery_minor       INTEGER NOT NULL,
  total_minor          INTEGER NOT NULL,
  chargeable_grams     INTEGER NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id             INTEGER PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id     INTEGER,
  shop_name      TEXT NOT NULL,
  name           TEXT NOT NULL,
  options        TEXT NOT NULL DEFAULT '{}',
  quantity       INTEGER NOT NULL,
  unit_price_minor INTEGER NOT NULL,
  weight_grams   INTEGER NOT NULL,
  line_ghs_minor INTEGER NOT NULL,
  source_url     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS link_requests (
  id         INTEGER PRIMARY KEY,
  url        TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  details    TEXT NOT NULL DEFAULT '',
  quantity   INTEGER NOT NULL DEFAULT 1,
  price_seen TEXT NOT NULL DEFAULT '',
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  email      TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'NEW',
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Filled in when the team quotes the request. The token is the customer's private link to pay for it.
  token             TEXT,
  quote_price_minor INTEGER,
  quote_weight_grams INTEGER,
  quote_note        TEXT NOT NULL DEFAULT '',
  quoted_at         TEXT,
  quote_expires_at  TEXT,
  order_id          INTEGER,
  item_type         TEXT NOT NULL DEFAULT '',
  quote_source      TEXT NOT NULL DEFAULT '',   -- '' = quoted by hand, 'page' = price read from the shop page, 'customer' = price the customer typed
  quote_basis_minor INTEGER                      -- the price before any safety margin
);

-- Keys and switches for every wired API. Secret values are stored encrypted.
CREATE TABLE IF NOT EXISTS integration_settings (
  provider   TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  is_secret  INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, key)
);

-- One row per payment attempt. provider_ref is the gateway's own reference.
CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  provider_ref  TEXT NOT NULL,
  attempt_ref   TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'PENDING',
  currency      TEXT NOT NULL,
  amount_minor  INTEGER NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_ref)
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);

-- Gateway events already handled, so a replayed webhook changes nothing.
CREATE TABLE IF NOT EXISTS webhook_events (
  provider    TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, event_id)
);

-- Outbox of customer messages (SMS, WhatsApp, email).
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY,
  order_id   INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  channel    TEXT NOT NULL,
  provider   TEXT NOT NULL DEFAULT '',
  recipient  TEXT NOT NULL,
  event      TEXT NOT NULL DEFAULT '',
  subject    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'PENDING',
  attempts   INTEGER NOT NULL DEFAULT 0,
  error      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at    TEXT
);
CREATE INDEX IF NOT EXISTS messages_status_idx ON messages (status, id);

-- Shopper accounts. Phone is stored as E.164, email lower-cased or NULL.
CREATE TABLE IF NOT EXISTS customers (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL UNIQUE,
  email            TEXT UNIQUE,
  password_hash    TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ACTIVE',
  notify_sms       INTEGER NOT NULL DEFAULT 1,
  notify_email     INTEGER NOT NULL DEFAULT 1,
  notify_whatsapp  INTEGER NOT NULL DEFAULT 0,
  default_zone_id  INTEGER,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at    TEXT
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash  TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  user_agent  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS customer_sessions_customer_idx ON customer_sessions (customer_id);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  recipient   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  zone_id     INTEGER,
  address     TEXT NOT NULL,
  landmark    TEXT NOT NULL DEFAULT '',
  is_default  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS customer_addresses_customer_idx ON customer_addresses (customer_id);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (customer_id, product_id)
);

-- Reviews are written only by customers who received the item.
CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  author      TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'PUBLISHED',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, customer_id)
);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews (product_id, status);

CREATE TABLE IF NOT EXISTS audit_log (
  id     INTEGER PRIMARY KEY,
  at     TEXT NOT NULL DEFAULT (datetime('now')),
  actor  TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS fx_rate_history (
  id         INTEGER PRIMARY KEY,
  rate       REAL NOT NULL,
  markup_pct REAL NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- What an order really cost us, to work out margin.
CREATE TABLE IF NOT EXISTS order_costs (
  order_id                 INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  retailer_gbp_minor       INTEGER NOT NULL DEFAULT 0,
  uk_delivery_gbp_minor    INTEGER NOT NULL DEFAULT 0,
  purchase_rate            REAL NOT NULL DEFAULT 0,
  freight_ghs_minor        INTEGER NOT NULL DEFAULT 0,
  local_delivery_ghs_minor INTEGER NOT NULL DEFAULT 0,
  payment_fees_ghs_minor   INTEGER NOT NULL DEFAULT 0,
  other_ghs_minor          INTEGER NOT NULL DEFAULT 0,
  note                     TEXT NOT NULL DEFAULT '',
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tracking references staff attach to an order as it moves (retailer carrier, UK receipt, airway bill, courier).
CREATE TABLE IF NOT EXISTS order_tracking (
  id         INTEGER PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stage      TEXT NOT NULL,
  carrier    TEXT NOT NULL DEFAULT '',
  reference  TEXT NOT NULL DEFAULT '',
  url        TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS order_tracking_order_idx ON order_tracking (order_id);

-- Catalogue ingestion. A source is one place we are allowed to read a shop's products from.
CREATE TABLE IF NOT EXISTS catalog_sources (
  id                  INTEGER PRIMARY KEY,
  shop_id             INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('feed_csv', 'feed_json', 'sitemap', 'links', 'ebay', 'shopify', 'upload')),
  url                 TEXT NOT NULL DEFAULT '',
  field_map           TEXT NOT NULL DEFAULT '{}',
  terms_url           TEXT NOT NULL DEFAULT '',
  terms_note          TEXT NOT NULL DEFAULT '',
  terms_confirmed_at  TEXT,
  enabled             INTEGER NOT NULL DEFAULT 0,
  auto_publish_new    INTEGER NOT NULL DEFAULT 1,
  auto_apply_updates  INTEGER NOT NULL DEFAULT 1,
  max_price_change_pct INTEGER NOT NULL DEFAULT 40,
  max_items           INTEGER NOT NULL DEFAULT 50,
  delay_ms            INTEGER NOT NULL DEFAULT 3000,
  interval_hours      INTEGER NOT NULL DEFAULT 24,
  stale_days          INTEGER NOT NULL DEFAULT 14,
  default_category    TEXT NOT NULL DEFAULT '',
  default_weight_grams INTEGER NOT NULL DEFAULT 500,
  last_run_at         TEXT,
  last_status         TEXT NOT NULL DEFAULT '',
  last_message        TEXT NOT NULL DEFAULT '',
  paused_until        TEXT,
  running_since       TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Everything we read, held here until a person (or an explicit rule) publishes it.
CREATE TABLE IF NOT EXISTS import_items (
  id             INTEGER PRIMARY KEY,
  source_id      INTEGER NOT NULL REFERENCES catalog_sources(id) ON DELETE CASCADE,
  external_id    TEXT NOT NULL,
  product_url    TEXT NOT NULL DEFAULT '',
  name           TEXT NOT NULL,
  brand          TEXT NOT NULL DEFAULT '',
  category       TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  price_minor    INTEGER NOT NULL,
  compare_at_minor INTEGER,
  image_url      TEXT NOT NULL DEFAULT '',
  in_stock       INTEGER NOT NULL DEFAULT 1,
  weight_grams   INTEGER,
  options        TEXT NOT NULL DEFAULT '[]',
  fingerprint    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'HELD', 'REJECTED')),
  hold_reason    TEXT NOT NULL DEFAULT '',
  product_id     INTEGER REFERENCES products(id) ON DELETE SET NULL,
  first_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_id, external_id)
);
CREATE INDEX IF NOT EXISTS import_items_status_idx ON import_items (status);

CREATE TABLE IF NOT EXISTS import_runs (
  id          INTEGER PRIMARY KEY,
  source_id   INTEGER NOT NULL REFERENCES catalog_sources(id) ON DELETE CASCADE,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status      TEXT NOT NULL DEFAULT 'RUNNING',
  fetched     INTEGER NOT NULL DEFAULT 0,
  created     INTEGER NOT NULL DEFAULT 0,
  updated     INTEGER NOT NULL DEFAULT 0,
  held        INTEGER NOT NULL DEFAULT 0,
  skipped     INTEGER NOT NULL DEFAULT 0,
  removed     INTEGER NOT NULL DEFAULT 0,
  message     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS import_runs_source_idx ON import_runs (source_id);
`;
