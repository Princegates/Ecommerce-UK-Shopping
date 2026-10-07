import type Database from "better-sqlite3";
import { db } from "./db";

type Db = Database.Database;

/**
 * Record an administrative action. Details are short, human-readable and must never contain
 * secrets: log that a key changed, not the key.
 */
export function audit(action: string, target = "", detail = "", d: Db = db(), actor = "admin"): void {
  try {
    d.prepare("INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)").run(actor, action.slice(0, 80), target.slice(0, 120), detail.slice(0, 400));
  } catch (e) {
    console.error("[audit] could not write", e instanceof Error ? e.message : "unknown error");
  }
}

export type AuditRow = { id: number; at: string; actor: string; action: string; target: string; detail: string };

export function recentAudit(limit = 100, q?: string, d: Db = db()): AuditRow[] {
  const like = `%${(q ?? "").trim().toLowerCase().replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  return d
    .prepare(
      `SELECT * FROM audit_log WHERE ? = '%%' OR LOWER(action) LIKE ? ESCAPE '\\' OR LOWER(target) LIKE ? ESCAPE '\\' OR LOWER(detail) LIKE ? ESCAPE '\\'
       ORDER BY id DESC LIMIT ?`,
    )
    .all(like, like, like, like, limit) as AuditRow[];
}
