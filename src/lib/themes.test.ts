import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import { getSettings, setSetting } from "./settings";
import { THEMES, contrast, getTheme, themeVars } from "./themes";

const INK = "#0f1111";
const WHITE = "#ffffff";

describe("themes", () => {
  it("offers fifteen distinct themes", () => {
    expect(THEMES).toHaveLength(15);
    expect(new Set(THEMES.map((x) => x.id)).size).toBe(15);
    expect(new Set(THEMES.map((x) => x.name)).size).toBe(15);
    expect(THEMES[0].id).toBe("ghana");
  });

  it("uses valid colours and falls back to the default for an unknown theme", () => {
    for (const th of THEMES) for (const k of ["head", "head2", "brand", "cta", "spark", "star", "link", "paper"] as const) expect(th[k], `${th.id}.${k}`).toMatch(/^#[0-9a-f]{6}$/);
    expect(getTheme("nope").id).toBe("ghana");
    expect(getTheme(undefined).id).toBe("ghana");
    expect(themeVars("royal")["--blue"]).toBe("#5b2bd6");
  });

  it("keeps text readable in every theme (WCAG AA)", () => {
    const all: string[] = [];
    for (const th of THEMES) {
      const bad: string[] = [];
      const need = (label: string, ratio: number, min: number) => { if (ratio < min) bad.push(`${th.id}: ${label} ${ratio.toFixed(2)} < ${min}`); };
      need("white on header", contrast(WHITE, th.head), 7);
      need("white on header 2", contrast(WHITE, th.head2), 4.5);
      need("white on brand", contrast(WHITE, th.brand), 4.5);
      need("dark on cta", contrast(INK, th.cta), 4.5);
      need("dark on spark", contrast(INK, th.spark), 4.5);
      need("link on white", contrast(th.link, WHITE), 4.5);
      need("link on page", contrast(th.link, th.paper), 4.2);
      need("dark on page", contrast(INK, th.paper), 12);
      all.push(...bad);
    }
    expect(all).toEqual([]);
  });

  it("stores the chosen theme in settings", () => {
    const d = openForTest();
    expect(getSettings(d).theme).toBe("ghana");
    setSetting("theme", "noir", d);
    expect(getSettings(d).theme).toBe("noir");
    setSetting("theme", "not-a-theme", d);
    expect(getSettings(d).theme).toBe("ghana");
  });
});
