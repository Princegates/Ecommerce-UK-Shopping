"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A photo that falls back to something else if the picture cannot load (a dead link in a feed, a shop that blocks
 * hotlinking). It also catches images that failed before the page finished loading in the browser.
 */
export default function PhotoImg({ src, alt, className, fallback }: { src: string; alt: string; className?: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bad = () => el.complete && el.naturalWidth === 0;
    if (bad()) {
      const t = setTimeout(() => setFailed(true), 0);
      return () => clearTimeout(t);
    }
  }, [src]);
  if (failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={src} alt={alt} referrerPolicy="no-referrer" decoding="async" loading="lazy" className={className} onError={() => setFailed(true)} />;
}
