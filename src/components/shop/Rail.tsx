"use client";

import { useRef, type ReactNode } from "react";

/** A horizontal shelf with previous and next buttons (swipe or scroll also works). */
export default function Rail({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * Math.max(240, ref.current.clientWidth * 0.8), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return (
    <div className="relative">
      <ul ref={ref} className="rail" aria-label={label}>{children}</ul>
      <button type="button" onClick={() => go(-1)} className="icon-btn absolute -left-3 top-1/3 hidden md:grid" aria-label={`Scroll ${label} back`}>‹</button>
      <button type="button" onClick={() => go(1)} className="icon-btn absolute -right-3 top-1/3 hidden md:grid" aria-label={`Scroll ${label} forward`}>›</button>
    </div>
  );
}
