import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every admin page and every admin server action must check who is asking. This reads the source so a new page or action
 * that forgets its check fails here instead of quietly being open to every staff account.
 */
const ROOT = path.join(process.cwd(), "src/app/admin");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

const files = walk(ROOT);
const rel = (f: string) => path.relative(process.cwd(), f);
const CHECK = /\b(requirePermission|requireSuper|requireAdmin)\(/;

// public on purpose: the sign-in page and the sign-in / sign-out actions
const PUBLIC_PAGES = new Set(["src/app/admin/login/page.tsx"]);
const PUBLIC_ACTIONS = new Set(["loginAction", "logoutAction"]);

describe("admin access checks", () => {
  it("every admin page checks who is asking", () => {
    const pages = files.filter((f) => f.endsWith("/page.tsx") && !PUBLIC_PAGES.has(rel(f)));
    expect(pages.length).toBeGreaterThan(20);
    const missing = pages.filter((f) => !CHECK.test(fs.readFileSync(f, "utf8"))).map(rel);
    expect(missing).toEqual([]);
  });

  it("every admin page that is not a general one asks for a specific right", () => {
    const general = ["account/page.tsx", "no-access/page.tsx", "layout.tsx"];
    const pages = files.filter((f) => f.endsWith("/page.tsx") && !PUBLIC_PAGES.has(rel(f)) && !general.some((g) => f.endsWith(g)));
    const loose = pages.filter((f) => !/\b(requirePermission|requireSuper)\(/.test(fs.readFileSync(f, "utf8")) && !/can\(who, "dashboard\.view"\)/.test(fs.readFileSync(f, "utf8"))).map(rel);
    expect(loose).toEqual([]);
  });

  it("every admin server action checks who is asking, before doing anything", () => {
    const actionFiles = files.filter((f) => /actions\.ts$/.test(f));
    expect(actionFiles.length).toBeGreaterThanOrEqual(4);
    const problems: string[] = [];
    for (const f of actionFiles) {
      const src = fs.readFileSync(f, "utf8");
      for (const part of src.split(/^(?=export async function )/m)) {
        const m = /^export async function (\w+)\(/.exec(part);
        if (!m || PUBLIC_ACTIONS.has(m[1])) continue;
        const firstLines = part.split("\n").slice(0, 8).join("\n");
        if (!CHECK.test(firstLines)) problems.push(`${rel(f)}: ${m[1]}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("only the super admin can reach staff management", () => {
    for (const f of files.filter((x) => /\/users\//.test(x) && x.endsWith("page.tsx"))) {
      expect(fs.readFileSync(f, "utf8")).toContain("requireSuper(");
    }
    const actions = fs.readFileSync(path.join(ROOT, "users-actions.ts"), "utf8");
    for (const name of ["createStaffAction", "updateStaffAction", "setStaffStatusAction", "resetStaffPasswordAction", "deleteStaffAction"]) {
      const part = actions.split(`export async function ${name}`)[1].split(/^export async function /m)[0];
      expect(part.slice(0, 200)).toContain("requireSuper(");
    }
  });

  it("the orders download route checks the export right", () => {
    const route = fs.readFileSync(path.join(ROOT, "export/orders/route.ts"), "utf8");
    expect(route).toContain('can(who, "orders.export")');
  });
});
