/* The logo files are small static images in /public/brand, so a plain <img> is the right tool (no resizing service is needed). */
/* eslint-disable @next/next/no-img-element */

const ICON = { src: "/brand/yenkoexpress-icon.png", w: 520, h: 285 };
const WORD = { src: "/brand/yenkoexpress-wordmark.png", w: 720, h: 442 };

/**
 * The cart icon on a white tile, so it reads on the dark header, footer and admin bars as well as on light pages.
 * The logo is the same on every theme; the written name beside it comes from the site settings.
 */
export function BrandMark({ className = "h-9" }: { className?: string }) {
  return (
    <span className={`inline-flex ${className} shrink-0 items-center rounded-lg bg-white px-1.5 py-1`} aria-hidden="true">
      <img src={ICON.src} width={ICON.w} height={ICON.h} alt="" className="h-full w-auto" />
    </span>
  );
}

/** The full stacked logo (name, address and tagline) for light backgrounds. */
export function BrandWordmark({ siteName, className = "h-24" }: { siteName: string; className?: string }) {
  return <img src={WORD.src} width={WORD.w} height={WORD.h} alt={siteName} className={`${className} w-auto`} />;
}
