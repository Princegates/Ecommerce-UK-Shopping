/** Five stars, filled to the average. Exposes the rating to screen readers as text. */
export default function Stars({ value, count, size = 16 }: { value: number | null; count?: number; size?: number }) {
  if (value === null) return null;
  const pct = Math.max(0, Math.min(5, value)) / 5;
  const label = `${value} out of 5 stars${count !== undefined ? `, ${count} review${count === 1 ? "" : "s"}` : ""}`;
  const star = "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z";
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={label}>
      <span className="relative inline-block leading-none" style={{ width: size * 5, height: size }} aria-hidden="true">
        <svg width={size * 5} height={size} viewBox="0 0 120 24" className="absolute inset-0" fill="none" stroke="var(--ink)" strokeWidth="1.5">
          {[0, 1, 2, 3, 4].map((i) => <path key={i} d={star} transform={`translate(${i * 24} 0)`} />)}
        </svg>
        <svg width={size * 5} height={size} viewBox="0 0 120 24" className="absolute inset-0" style={{ clipPath: `inset(0 ${(1 - pct) * 100}% 0 0)` }} fill="var(--gold)" stroke="var(--ink)" strokeWidth="1.5">
          {[0, 1, 2, 3, 4].map((i) => <path key={i} d={star} transform={`translate(${i * 24} 0)`} />)}
        </svg>
      </span>
      {count !== undefined && <span className="num text-xs font-semibold text-ink-soft" aria-hidden="true">({count})</span>}
    </span>
  );
}
