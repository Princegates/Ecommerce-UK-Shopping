import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
import { removeSampleData, seedIfEmpty } from "./seed";

type Db = Database.Database;

const globalForDb = globalThis as unknown as { __shopDb?: Db };

function open(): Db {
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "shop.db");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  const sample = process.env.SEED_SAMPLE_DATA === "true";
  seedIfEmpty(db, { sample });
  if (!sample) removeSampleData(db);
  return db;
}

/** Columns added after the first release, applied to databases created before them. */
export function migrate(d: Db): void {
  widenSourceKinds(d);
  const has = (table: string) => (d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  const orderCols = has("orders");
  const add = (name: string, ddl: string) => {
    if (!orderCols.includes(name)) d.exec(`ALTER TABLE orders ADD COLUMN ${ddl}`);
  };
  add("notify_sms", "notify_sms INTEGER NOT NULL DEFAULT 1");
  add("notify_email", "notify_email INTEGER NOT NULL DEFAULT 1");
  add("notify_whatsapp", "notify_whatsapp INTEGER NOT NULL DEFAULT 0");

  add("customer_id", "customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL");

  if (!has("customers").includes("updates_seen_at")) d.exec("ALTER TABLE customers ADD COLUMN updates_seen_at TEXT");

  const productCols = has("products");
  if (!productCols.includes("compare_at_minor")) d.exec("ALTER TABLE products ADD COLUMN compare_at_minor INTEGER");
  if (!productCols.includes("deal_ends_at")) d.exec("ALTER TABLE products ADD COLUMN deal_ends_at TEXT");
  if (!productCols.includes("last_synced_at")) d.exec("ALTER TABLE products ADD COLUMN last_synced_at TEXT");
  if (!has("link_requests").includes("customer_id")) d.exec("ALTER TABLE link_requests ADD COLUMN customer_id INTEGER");

  d.prepare("UPDATE settings SET value = ? WHERE key = 'site_name' AND value = ?").run(JSON.stringify("SHOP UK FROM GH"), JSON.stringify("Akwaaba UK"));

  const msgCols = has("messages");
  if (!msgCols.includes("payload")) d.exec("ALTER TABLE messages ADD COLUMN payload TEXT NOT NULL DEFAULT ''");
  if (!msgCols.includes("locked_at")) d.exec("ALTER TABLE messages ADD COLUMN locked_at TEXT");
}

/**
 * Databases made before eBay support only allow four kinds of catalogue source. SQLite cannot change a CHECK
 * constraint in place, so the table is rebuilt once with the wider rule (rows, and the items that point at them, are kept).
 */
function widenSourceKinds(d: Db): void {
  const t = d.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'catalog_sources'").get() as { sql: string } | undefined;
  if (!t || t.sql.includes("'ebay'")) return;
  const widened = t.sql.replace("'links')", "'links', 'ebay')").replace(/CREATE TABLE (IF NOT EXISTS )?"?catalog_sources"?/i, "CREATE TABLE catalog_sources_new");
  d.pragma("foreign_keys = OFF");
  try {
    d.transaction(() => {
      d.exec(widened);
      d.exec("INSERT INTO catalog_sources_new SELECT * FROM catalog_sources");
      d.exec("DROP TABLE catalog_sources");
      d.exec("ALTER TABLE catalog_sources_new RENAME TO catalog_sources");
    })();
  } finally {
    d.pragma("foreign_keys = ON");
  }
}

export function db(): Db {
  globalForDb.__shopDb ??= open();
  return globalForDb.__shopDb;
}

/** Open a fresh in-memory database (used by tests). */
export function openForTest(): Db {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  d.exec(SCHEMA);
  migrate(d);
  seedIfEmpty(d);
  return d;
}
