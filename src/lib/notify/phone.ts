/**
 * Normalise a phone number to E.164 digits. Numbers without a country code are treated as Ghana.
 * Returns null when the result cannot be a real number.
 */
export function toE164(input: string, defaultCountry = "233"): string | null {
  let d = input.replace(/[^\d+]/g, "");
  const hadPlus = d.startsWith("+");
  d = d.replace(/\D/g, "");
  if (!d) return null;
  if (!hadPlus && d.startsWith("00")) d = d.slice(2);
  else if (!hadPlus && d.startsWith("0")) d = defaultCountry + d.slice(1);
  else if (!hadPlus && d.length === 9) d = defaultCountry + d;
  if (d.length < 11 || d.length > 15) return null;
  if (d.startsWith(defaultCountry) && d.length !== 12) return null; // Ghana numbers are +233 and nine digits
  return `+${d}`;
}

export const digitsOnly = (e164: string) => e164.replace(/\D/g, "");

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}
