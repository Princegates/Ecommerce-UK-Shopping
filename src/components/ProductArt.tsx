function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "?").toUpperCase() + (words[1]?.[0]?.toLowerCase() ?? "");
}

/**
 * Stand-in artwork shown when a product has no licensed image. It is coloured by the
 * shop so a page of products still reads as a page of different shops.
 */
export default function ProductArt({
  name,
  accent,
  imageUrl,
}: {
  name: string;
  accent: string;
  imageUrl?: string | null;
}) {
  if (imageUrl) {
    return (
      <div className="art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={name} className="absolute inset-0 h-full w-full object-contain p-3" loading="lazy" />
      </div>
    );
  }
  return (
    <div className="art" role="img" aria-label={`${name} (image coming soon)`} style={{ "--art-accent": accent } as React.CSSProperties}>
      <b aria-hidden="true">{initials(name)}</b>
    </div>
  );
}
