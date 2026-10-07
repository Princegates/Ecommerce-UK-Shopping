import { gbp, ghs } from "@/lib/money";
import { gbpToGhsMinor, type FxConfig } from "@/lib/pricing";

function split(minor: number): { whole: string; frac: string } {
  const [whole, frac] = (minor / 100).toFixed(2).split(".");
  return { whole: Number(whole).toLocaleString("en-GB"), frac };
}

/**
 * Every price on the site is shown twice: what it costs at the UK shop in pounds, and what it
 * costs you in cedis at today's rate. `size` picks how loud the cedi figure is.
 */
export default function Price({
  gbpMinor, wasGbpMinor, fx, size = "md", className = "",
}: {
  gbpMinor: number;
  wasGbpMinor?: number | null;
  fx: FxConfig;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const cedis = gbpToGhsMinor(gbpMinor, fx);
  const wasCedis = wasGbpMinor ? gbpToGhsMinor(wasGbpMinor, fx) : null;
  const { whole, frac } = split(cedis);
  const big = size === "lg" ? "text-4xl" : size === "md" ? "text-[1.55rem]" : "text-lg";
  const small = size === "lg" ? "text-base" : "text-xs";
  return (
    <div className={`num ${className}`}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={`${big} font-bold leading-none tracking-tight text-ink`} aria-label={ghs(cedis)}>
          <span className={`${small} mr-0.5 font-semibold text-ink-soft`}>GH₵</span>
          {whole}
          <span className={`${small} font-semibold text-ink-soft`}>.{frac}</span>
        </span>
        {wasCedis && <span className="was text-sm" aria-label={`was ${ghs(wasCedis)}`}>{ghs(wasCedis)}</span>}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="rounded-md bg-spark/45 px-1.5 py-0.5 text-xs font-bold text-ink">{gbp(gbpMinor)} in the UK</span>
        {wasGbpMinor ? <span className="was text-xs" aria-label={`was ${gbp(wasGbpMinor)}`}>{gbp(wasGbpMinor)}</span> : null}
      </p>
    </div>
  );
}
