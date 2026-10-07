import { PROGRESS, STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

/** Horizontal progress strip for the happy path. Cancelled and refunded orders get a banner instead. */
export default function StatusTracker({ status }: { status: OrderStatus }) {
  if (status === "CANCELLED" || status === "REFUNDED") {
    return (
      <p className={`box p-4 font-semibold ${status === "REFUNDED" ? "bg-gold/40" : "bg-red/10"}`}>
        {STATUS_LABEL[status]}
      </p>
    );
  }
  const current = PROGRESS.indexOf(status);
  return (
    <ol className="grid gap-0 sm:grid-cols-4 lg:grid-cols-8" aria-label="Order progress">
      {PROGRESS.map((s, i) => {
        const done = current > i;
        const here = current === i;
        return (
          <li
            key={s}
            aria-current={here ? "step" : undefined}
            className={`relative border-t-4 pt-2 pb-4 pr-2 ${done || here ? "border-green" : "border-ink/25"}`}
          >
            <span
              className={`mono mb-1 grid h-6 w-6 place-items-center border-2 text-xs font-semibold ${
                done ? "border-green bg-green text-paper" : here ? "border-ink bg-gold" : "border-ink/30 text-ink/40"
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
  );
}
