const num = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ghs(minor: number): string {
  return `GH₵${num.format(minor / 100)}`;
}

export function gbp(minor: number): string {
  return `£${num.format(minor / 100)}`;
}

/** "12.50" -> 1250. Returns null for anything that is not a non-negative amount. */
export function parseMinor(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

export function minorToInput(minor: number): string {
  return (minor / 100).toFixed(2);
}
