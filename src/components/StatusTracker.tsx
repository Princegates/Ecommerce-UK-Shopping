import { PROGRESS, STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

/**
 * Progress strip for the happy path. Cancelled and refunded orders get a banner instead.
 * The number of columns follows the width of the space it is placed in, not the width of the screen, so it still reads in a narrow card.
 * `compact` is a slim bar with "Step 3 of 8", for small cards where the full strip would not fit at any width.
 */
export default function StatusTracker({ status, compact = false }: { status: OrderStatus; compact?: boolean }) {
  if (status === "CANCELLED" || status === "REFUNDED") {
    return (
      <p className={`box p-4 font-semibold ${status === "REFUNDED" ? "bg-gold/40" : "bg-red/10"}`}>
        {STATUS_LABEL[status]}
      </p>
    );
  }
  const current = PROGRESS.indexOf(status);
  if (compact) {
    return (
      <div aria-label="Order progress">
        <div className="flex gap-0.5" aria-hidden="true">
          {PROGRESS.map((s, i) => <span key={s} className={`h-1.5 flex-1 ${current >= i ? "bg-green" : "bg-line"}`} />)}
        </div>
        <p className="mt-1.5 text-xs text-ink-soft">
          {current >= 0 ? <><span className="font-semibold text-ink">Step {current + 1} of {PROGRESS.length}</span> · {STATUS_LABEL[status]}</> : "Waiting for payment"}
        </p>
      </div>
    );
  }
  return (
    <div className="@container">
    <ol className="grid grid-cols-2 gap-0 @md:grid-cols-4 @4xl:grid-cols-8" aria-label="Order progress">
      {PROGRESS.map((s, i) => {
        const done = current > i;
        const here = current === i;
        return (
          <li
            key={s}
            aria-current={here ? "step" : undefined}
            className={`relative border-t-4 pt-2 pb-4 pr-2 ${done || here ? "border-green" : "border-line"}`}
          >
            <span
              className={`mono mb-1 grid h-6 w-6 place-items-center border-2 text-xs font-semibold ${
                done ? "border-green bg-green text-paper" : here ? "border-line bg-gold" : "border-line text-ink/40"
              }`}
              aria-hidden="true"
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`block text-sm leading-tight ${here ? "font-bold" : done ? "" : "text-ink/50"}`}>
              {STATUS_LABEL[s]}
              {done && <span className="sr-only"> (done)</span>}
              {here && <span className="sr-only"> (current)</span>}
            </span>
          </li>
        );
      })}
    </ol>
    </div>
  );
}
