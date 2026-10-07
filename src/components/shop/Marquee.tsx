import type { ReactNode } from "react";

/**
 * A strip that scrolls sideways forever. The list is drawn twice so the loop is seamless; the second copy is
 * hidden from assistive tech and keyboard focus. Hovering or focusing pauses it. With reduced motion it
 * becomes an ordinary scrollable row.
 */
export default function Marquee({
  children, label, seconds = 45, reverse = false, className = "",
}: { children: ReactNode; label: string; seconds?: number; reverse?: boolean; className?: string }) {
  return (
    <div className={`marquee ${className}`} role="region" aria-label={label}>
      <div className={`marquee-track ${reverse ? "reverse" : ""}`} style={{ "--marquee-duration": `${seconds}s` } as React.CSSProperties}>
        <ul className="marquee-group">{children}</ul>
        <ul className="marquee-group" aria-hidden="true" inert>{children}</ul>
      </div>
    </div>
  );
}
