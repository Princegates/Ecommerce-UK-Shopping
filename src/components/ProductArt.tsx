import PhotoImg from "./PhotoImg";

const ICONS: Record<string, string> = {
  shoe: "M2 17v-3c0-1 .8-2 2-2h3l2-4 3 3h3c3 0 5 2 5 5v1H2z M2 17h20",
  shirt: "M8 3L3 6l2 4 2-1v11h10V9l2 1 2-4-5-3c0 2-1.500 3-4 3S8 5 8 3z",
  bag: "M5 8h14l1 13H4L5 8z M9 8V6a3 3 0 016 0v2",
  headphones: "M4 15v-3a8 8 0 0116 0v3 M4 15h3v5H4z M17 15h3v5h-3z",
  laptop: "M4 6h16v10H4z M2 19h20",
  phone: "M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1z M11 19h2",
  pot: "M4 10h16v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8z M2 10h20 M9 6v1 M12 4v3 M15 6v1",
  bottle: "M9 2h6v3l1 2v13a2 2 0 01-2 2h-4a2 2 0 01-2-2V7l1-2V2z M9 12h6",
  ball: "M12 3a9 9 0 100 18 9 9 0 000-18z M12 3v18 M3 12h18 M6 5.500c3 3 9 3 12 0 M6 18.500c3-3 9-3 12 0",
  teddy: "M12 9a4 4 0 100 .1 M6.500 5a2 2 0 100-.1 M17.500 5a2 2 0 100-.1 M7 21v-3a5 5 0 0110 0v3",
  book: "M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2V5z M8 7h6",
  wrench: "M14 6a4 4 0 105 5l-2 2-3-3 2-2-2-2z M3 21l9-9",
  box: "M3 7l9-4 9 4v10l-9 4-9-4V7z M3 7l9 4 9-4 M12 11v10",
};

const RULES: [RegExp, string][] = [
  [/shoe|trainer|boot|sneaker|sandal/, "shoe"],
  [/earbud|headphone|speaker|audio|sound/, "headphones"],
  [/laptop|computer|tablet|monitor|keyboard|notebook/, "laptop"],
  [/phone|mobile|charger|cable|smartwatch/, "phone"],
  [/bag|tote|backpack|luggage|wallet/, "bag"],
  [/jacket|jeans|shirt|sweat|coat|dress|trouser|hoodie|fashion|clothing|apparel|top\b/, "shirt"],
  [/football|\bball\b|gym|running|sport|yoga|fitness|training/, "ball"],
  [/baby|kids|toy|nappy|child|infant/, "teddy"],
  [/book|study|workbook|stationery|guide|novel/, "book"],
  [/drill|tool|socket|car\b|tyre|inflator|jump|laser|driver|garage/, "wrench"],
  [/serum|cream|skin|beauty|shampoo|perfume|health|cosmetic|lotion/, "bottle"],
  [/pot|cookware|kettle|\bpan\b|kitchen|home|bedding|furniture|lamp|cushion|mug|plate/, "pot"],
];

function iconFor(category: string, name: string): string {
  const text = `${category} ${name}`.toLowerCase();
  for (const [re, key] of RULES) if (re.test(text)) return ICONS[key];
  return ICONS.box;
}

/**
 * Shown when a product has no photo: a clean picture for its kind of product, tinted with the shop's colour.
 * Real photos (uploaded, or read from a feed or product page) replace it automatically.
 */
export default function ProductArt({
  name,
  accent,
  imageUrl,
  category = "",
}: {
  name: string;
  accent: string;
  imageUrl?: string | null;
  category?: string;
}) {
  const icon = (
    <span className="art-icon" role="img" aria-label={`${name} (photo coming soon)`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconFor(category, name)} /></svg>
    </span>
  );
  return (
    <div className="art" style={{ "--art-accent": accent } as React.CSSProperties}>
      {imageUrl ? <PhotoImg src={imageUrl} alt={name} className="absolute inset-0 h-full w-full object-contain p-3" fallback={icon} /> : icon}
    </div>
  );
}
