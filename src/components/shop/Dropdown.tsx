"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** A button that opens a panel. Closes on Escape, on a click outside, and when focus leaves. */
export default function Dropdown({
  label, children, className = "", panelClassName = "", align = "left",
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={root} className="relative" onBlur={(e) => { if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button type="button" className={className} aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open && (
        <div id={id} className={`panel absolute z-50 mt-2 ${align === "right" ? "right-0" : "left-0"} ${panelClassName}`} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
          {children}
        </div>
      )}
    </div>
  );
}
