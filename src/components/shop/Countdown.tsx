"use client";

import { useEffect, useState } from "react";

function parse(end: string): number {
  return Date.parse(end.includes("T") ? end : `${end.replace(" ", "T")}Z`);
}

/** Time left on a real deal. Shows nothing until the browser takes over, so there is no mismatch. */
export default function Countdown({ endsAt, className = "" }: { endsAt: string; className?: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const end = parse(endsAt);
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  if (left === null) return <span className={className} style={{ minWidth: "9ch", display: "inline-block" }} aria-hidden="true">&nbsp;</span>;
  if (left === 0) return <span className={className}>Deal ended</span>;
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return (
    <span className={`num mono ${className}`} role="timer" aria-label={`Deal ends in ${d ? `${d} days ` : ""}${h} hours ${m} minutes`}>
      {text}
    </span>
  );
}
