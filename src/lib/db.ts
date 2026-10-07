import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
import { seedIfEmpty } from "./seed";

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
  seedIfEmpty(db);
  return db;
}

/** Columns added after the first release, applied to databases created before them. */
function migrate(d: Db): void {
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
  if (!has("link_requests").includes("customer_id")) d.exec("ALTER TABLE link_requests ADD COLUMN customer_id INTEGER");

  const msgCols = has("messages");
  if (!msgCols.includes("payload")) d.exec("ALTER TABLE messages ADD COLUMN payload TEXT NOT NULL DEFAULT ''");
  if (!msgCols.includes("locked_at")) d.exec("ALTER TABLE messages ADD COLUMN locked_at TEXT");
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
