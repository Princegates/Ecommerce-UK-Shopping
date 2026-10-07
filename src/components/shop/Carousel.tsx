"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Hero slider. Autoplays, but stops for hover, focus, a hidden tab, or people who ask for less motion,
 * and every slide stays reachable with the dots, the arrows and the keyboard.
 */
export default function Carousel({ slides, label, interval = 7000 }: { slides: ReactNode[]; label: string; interval?: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);
  const n = slides.length;

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  useEffect(() => {
    if (paused || n < 2 || reduced.current) return;
    const t = setInterval(() => { if (!document.hidden) setI((v) => (v + 1) % n); }, interval);
    return () => clearInterval(t);
  }, [paused, n, interval]);

  const go = (v: number) => setI(((v % n) + n) % n);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="relative min-w-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") go(i - 1); if (e.key === "ArrowRight") go(i + 1); }}
    >
      <div className="overflow-hidden">
        <div className="flex transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${i * 100}%)` }} aria-live={paused ? "polite" : "off"}>
          {slides.map((s, idx) => (
            <div key={idx} role="group" aria-roledescription="slide" aria-label={`${idx + 1} of ${n}`} aria-hidden={idx !== i} inert={idx !== i} className="w-full shrink-0">
              {s}
            </div>
          ))}
        </div>
      </div>
      {n > 1 && (
        <>
          <button type="button" className="icon-btn absolute left-3 top-1/2 hidden -translate-y-1/2 md:grid" onClick={() => go(i - 1)} aria-label="Previous slide">‹</button>
          <button type="button" className="icon-btn absolute right-3 top-1/2 hidden -translate-y-1/2 md:grid" onClick={() => go(i + 1)} aria-label="Next slide">›</button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2" role="group" aria-label="Choose a slide">
            {slides.map((_, idx) => (
              <button key={idx} type="button" onClick={() => go(idx)} aria-label={`Slide ${idx + 1}`} aria-current={idx === i} className={`h-3 border-2 border-ink ${idx === i ? "w-8 bg-ink" : "w-3 bg-paper-3"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
