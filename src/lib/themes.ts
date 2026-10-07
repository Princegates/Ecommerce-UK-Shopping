/**
 * Colour themes for the whole shop. Only a handful of brand colours are chosen per theme; the shades
 * (hover, soft backgrounds, borders) are worked out in CSS with color-mix, so a theme stays consistent.
 *
 *  head / head2   header strip, footer and other dark surfaces
 *  brand          main action colour (checkout, selected states, links in buttons)
 *  cta            the "Add to cart" colour; dark text sits on it
 *  spark          price and savings tags; dark text sits on it
 *  star           ratings and small highlights
 *  link           text links on white
 *  paper          page background
 */
export type Theme = {
  id: string;
  name: string;
  mood: string;
  head: string;
  head2: string;
  brand: string;
  cta: string;
  spark: string;
  star: string;
  link: string;
  paper: string;
};

const t = (id: string, name: string, mood: string, head: string, head2: string, brand: string, cta: string, spark: string, link: string, paper: string, star = "#f59e0b"): Theme => ({
  id, name, mood, head, head2, brand, cta, spark, star, link, paper,
});

export const DEFAULT_THEME = "ghana";

export const THEMES: Theme[] = [
  t("ghana", "Ghana green and gold", "Local, warm and trustworthy", "#0b3d2e", "#14573f", "#0a7a4f", "#f5b800", "#ffcc33", "#0a6b47", "#f1f3ef"),
  t("kente", "Kente heritage", "Deep red with green and gold", "#5c0a14", "#7d1220", "#0a7a4f", "#f5b800", "#ffcc33", "#0a6b47", "#f6f1ea"),
  t("emerald", "Emerald and rose gold", "Calm green with a soft peach button", "#053b2e", "#0a5a45", "#0a7d5a", "#f4b69b", "#f8cbb7", "#0a6e50", "#eff5f2"),
  t("forest", "Forest and lime", "Natural green with a fresh lime button", "#14301f", "#1f4a31", "#2d7a46", "#b6e03a", "#c9ee6b", "#26683c", "#f0f4ee"),
  t("lagoon", "Lagoon teal and coral", "Fresh and friendly", "#0b3c49", "#115566", "#0f7c8f", "#ff7a59", "#ffb199", "#0b6577", "#eef3f4"),
  t("ocean", "Ocean blue and aqua", "Clean and calm", "#08233f", "#0e3a66", "#0069b4", "#26d0ce", "#7fe7e5", "#00588f", "#edf4f8"),
  t("classic", "Marketplace blue", "Familiar navy and sunny yellow", "#12263f", "#1d3a5f", "#0b66c3", "#ffc220", "#ffd34d", "#00629e", "#eef1f5"),
  t("graphite", "Graphite and electric blue", "Neutral with a bright blue accent", "#1b222c", "#2c3643", "#2b63e0", "#ffcc00", "#ffd633", "#1f4fc0", "#f0f2f5"),
  t("indigo", "Indigo and sunshine", "Deep blue-violet with warm yellow", "#1b1646", "#2a2470", "#4338ca", "#fbbf24", "#fcd34d", "#3730a3", "#f1f1f9"),
  t("royal", "Royal purple and orange", "Bold and modern", "#2a1457", "#3d2080", "#5b2bd6", "#ff9d1a", "#ffb84d", "#4c22b8", "#f3f1f8"),
  t("rose", "Rose and plum", "Rich plum with a pink button", "#3d1236", "#5a1d50", "#b4235f", "#ff9db8", "#ffbfd0", "#9b1c51", "#f7f0f3"),
  t("sunset", "Sunset maroon and amber", "Warm and energetic", "#4a0f1c", "#6b1a2b", "#b3261e", "#ffb020", "#ffc247", "#9c1f18", "#f6f0ec"),
  t("noir", "Noir and red", "Sharp black with red and yellow", "#111111", "#262626", "#c8102e", "#ffd400", "#ffd400", "#b00d28", "#f2f2f2"),
  t("copper", "Espresso and copper", "Earthy brown with a golden button", "#2b1d16", "#43302a", "#a24f06", "#f2b84b", "#f6cd78", "#8f4505", "#f5f0ea"),
  t("slate", "Slate and citrus", "Cool slate with a bright lime button", "#0f172a", "#1e293b", "#0b79b8", "#a3e635", "#bef264", "#09699e", "#eef1f4"),
];

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((x) => x.id === id) ?? THEMES[0];
}

/** The CSS variables for a theme, ready to put in a style attribute on <html>. */
export function themeVars(id: string | null | undefined): Record<string, string> {
  const th = getTheme(id);
  return {
    "--navy": th.head,
    "--navy-2": th.head2,
    "--blue": th.brand,
    "--cta": th.cta,
    "--spark": th.spark,
    "--orange": th.star,
    "--link": th.link,
    "--paper": th.paper,
  };
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
