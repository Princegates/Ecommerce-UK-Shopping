import { ghs } from "@/lib/money";
import type { DayPoint } from "@/lib/analytics";

/** Daily revenue as bars. Hover (or focus the table for screen readers) gives each day's exact figures. */
export function SalesChart({ points }: { points: DayPoint[] }) {
  const W = 720, H = 240, L = 56, R = 12, T = 12, B = 30;
  const max = Math.max(1, ...points.map((p) => p.revenueMinor));
  const step = niceStep(max / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const bw = (W - L - R) / points.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const labelEvery = points.length > 45 ? 14 : points.length > 14 ? 7 : 1;
  const total = points.reduce((n, p) => n + p.revenueMinor, 0);
  const orders = points.reduce((n, p) => n + p.orders, 0);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Daily revenue over ${points.length} days: ${ghs(total)} from ${orders} orders`} className="w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--ink)" strokeOpacity={t === 0 ? 0.9 : 0.12} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-soft)" fontFamily="var(--font-mono)">{short(t)}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const h = (H - T - B) * (p.revenueMinor / top);
          return (
            <g key={p.day}>
              <rect x={L + i * bw + bw * 0.14} y={y(p.revenueMinor)} width={Math.max(1, bw * 0.72)} height={h} fill={p.revenueMinor ? "var(--green)" : "transparent"}>
                <title>{`${p.day}: ${ghs(p.revenueMinor)} from ${p.orders} order${p.orders === 1 ? "" : "s"}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={L + i * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--ink-soft)" fontFamily="var(--font-mono)">{p.day.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="label mt-1">Revenue per day, GH₵. Paid orders only.</figcaption>
      <table className="sr-only">
        <caption>Daily revenue and orders</caption>
        <thead><tr><th>Day</th><th>Orders</th><th>Revenue</th></tr></thead>
        <tbody>{points.map((p) => <tr key={p.day}><td>{p.day}</td><td>{p.orders}</td><td>{ghs(p.revenueMinor)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 100)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

function short(minor: number): string {
  const v = minor / 100;
  return v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(Math.round(v));
}

/** Horizontal bars for a ranked list. */
export function RankBars({ rows, format }: { rows: { name: string; value: number; sub?: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-ink-soft">Nothing yet in this period.</p>;
  return (
    <ol className="grid gap-3">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold">{r.name}</span>
            <span className="num whitespace-nowrap">{format(r.value)}</span>
          </div>
          <div className="mt-1 h-2.5 border border-line bg-paper-2" aria-hidden="true">
            <div className="h-full bg-green" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
          {r.sub && <p className="label mt-0.5">{r.sub}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Up or down against the previous period. "up" is good for every figure shown with it. */
export function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="label">new</span>;
  if (Math.abs(value) < 0.0005) return <span className="label">no change</span>;
  const up = value > 0;
  return (
    <span className={`mono text-xs font-semibold ${up ? "text-green" : "text-red"}`}>
      {up ? "▲" : "▼"} {Math.abs(value * 100).toFixed(value > 9.99 || value < -9.99 ? 0 : 1)}%
      <span className="sr-only"> {up ? "up" : "down"} on the previous period</span>
    </span>
  );
}

/** One stacked bar showing what makes up the money customers paid. */
export function Composition({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (total === 0) return <p className="text-sm text-ink-soft">No paid orders in this period.</p>;
  return (
    <div>
      <div className="flex h-8 border border-line" role="img" aria-label={parts.map((p) => `${p.label} ${((p.value / total) * 100).toFixed(0)}%`).join(", ")}>
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${ghs(p.value)}`} />
        ))}
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><span className="h-3 w-3 border border-line" style={{ background: p.color }} aria-hidden="true" />{p.label}</span>
            <span className="num">{ghs(p.value)} <span className="label">{((p.value / total) * 100).toFixed(0)}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
