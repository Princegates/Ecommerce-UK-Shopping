-- Catalogue and Buy-for-Me schema (PostgreSQL). Draft for review.
-- Money is stored as integer minor units (pence / pesewas) with an explicit currency.
-- Every source (manual, feed, API, customer link) maps to the same product shape.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE integration_mode AS ENUM (
  'OFFICIAL_API', 'PRODUCT_FEED', 'APPROVED_INTEGRATION',
  'MANUAL_CATALOGUE', 'BUY_FOR_ME', 'INACTIVE'
);

CREATE TYPE product_source AS ENUM ('MANUAL', 'FEED', 'API', 'CUSTOMER_LINK');

-- ---------------------------------------------------------------- retailers

CREATE TABLE retailers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  logo_url          text,
  description       text,
  website_url       text NOT NULL,
  integration_mode  integration_mode NOT NULL DEFAULT 'BUY_FOR_ME',
  is_active         boolean NOT NULL DEFAULT false,
  purchasing_notes  text,
  return_policy     text,
  uk_delivery_notes text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Output of retailer-assessment-template.md, kept as evidence.
CREATE TABLE retailer_assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id       uuid NOT NULL REFERENCES retailers(id),
  assessed_by       uuid,
  assessed_at       date NOT NULL,
  agent_purchase_allowed text CHECK (agent_purchase_allowed IN ('yes','no','unclear')),
  image_licence_ok  boolean,
  score_total       smallint CHECK (score_total BETWEEN 0 AND 10),
  decision          integration_mode NOT NULL,
  notes             text,
  sources           jsonb NOT NULL DEFAULT '[]',
  review_due        date
);

CREATE TABLE categories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES categories(id),
  slug      text NOT NULL UNIQUE,
  name      text NOT NULL
);

-- Shipping-restriction tags (batteries, liquids, ...) used at add-to-cart / quote time.
CREATE TABLE restriction_tags (
  code        text PRIMARY KEY,
  description text NOT NULL,
  blocks_air  boolean NOT NULL DEFAULT false,
  blocks_import boolean NOT NULL DEFAULT false
);

-- ----------------------------------------------------------------- products

CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id     uuid NOT NULL REFERENCES retailers(id),
  category_id     uuid REFERENCES categories(id),
  source          product_source NOT NULL,
  retailer_sku    text,
  name            text NOT NULL,
  brand           text,
  description     text,
  product_url     text NOT NULL,
  weight_grams    integer,
  length_mm       integer,
  width_mm        integer,
  height_mm       integer,
  is_available    boolean NOT NULL DEFAULT true,
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retailer_id, retailer_sku)
);
CREATE INDEX products_retailer_idx ON products (retailer_id);
CREATE INDEX products_search_idx ON products
  USING gin (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(brand,'')));

CREATE TABLE product_restrictions (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_code   text NOT NULL REFERENCES restriction_tags(code),
  PRIMARY KEY (product_id, tag_code)
);

CREATE TABLE product_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         text NOT NULL,
  storage_key text,               -- set when we hold a licensed copy
  licensed    boolean NOT NULL DEFAULT false,
  position    smallint NOT NULL DEFAULT 0
);

-- Variants: each row is one purchasable combination (e.g. UK 9 / Black).
CREATE TABLE product_variants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer_sku text,
  attributes   jsonb NOT NULL DEFAULT '{}',   -- {"size":"UK 9","colour":"Black"}
  is_available boolean NOT NULL DEFAULT true,
  UNIQUE (product_id, attributes)
);

-- Price history; current price is the latest row. Never overwrite.
CREATE TABLE product_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id    uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  amount_minor  integer NOT NULL CHECK (amount_minor >= 0),
  currency      char(3) NOT NULL DEFAULT 'GBP',
  observed_at   timestamptz NOT NULL DEFAULT now(),
  observed_via  text NOT NULL            -- 'feed','api','manual','staff_verified'
);
CREATE INDEX product_prices_latest_idx ON product_prices (variant_id, observed_at DESC);

CREATE TABLE product_sync_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id),
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL,
  created     integer NOT NULL DEFAULT 0,
  updated     integer NOT NULL DEFAULT 0,
  failed      integer NOT NULL DEFAULT 0,
  error       text
);

-- ------------------------------------------------------------- Buy-for-Me

CREATE TYPE bfm_status AS ENUM (
  'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'QUOTED',
  'ACCEPTED', 'EXPIRED', 'REJECTED', 'CANCELLED'
);

CREATE TABLE buy_for_me_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number  text NOT NULL UNIQUE,
  customer_id     uuid NOT NULL,
  retailer_id     uuid REFERENCES retailers(id),   -- set by staff once identified
  product_url     text NOT NULL,
  customer_notes  text,
  -- details entered by the customer, verified by staff
  title           text,
  size            text,
  colour          text,
  quantity        integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  customer_price_minor integer,                    -- what the customer saw
  verified_price_minor integer,                    -- what staff confirmed
  currency        char(3) NOT NULL DEFAULT 'GBP',
  restriction_flags text[] NOT NULL DEFAULT '{}',
  status          bfm_status NOT NULL DEFAULT 'SUBMITTED',
  rejected_reason text,
  assigned_to     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfm_status_idx ON buy_for_me_requests (status, created_at);

CREATE TABLE quotes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_for_me_id    uuid REFERENCES buy_for_me_requests(id),
  cart_id          uuid,
  customer_id      uuid NOT NULL,
  fx_rate          numeric(14,6) NOT NULL,        -- GBP -> GHS actually used
  fx_source        text NOT NULL,
  fx_markup_pct    numeric(6,3) NOT NULL DEFAULT 0,
  breakdown        jsonb NOT NULL,                -- every line item, minor units
  total_ghs_minor  bigint NOT NULL,
  valid_until      timestamptz NOT NULL,
  accepted_at      timestamptz,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (buy_for_me_id IS NOT NULL OR cart_id IS NOT NULL)
);
