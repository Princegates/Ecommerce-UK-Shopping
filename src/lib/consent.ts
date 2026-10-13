/**
 * The visitor's cookie choice, kept in one small cookie of our own. It is client-side code: the shop sets no advertising or tracking
 * cookies, so the only thing the choice controls is the optional "recently viewed" memory kept in this browser.
 */
export const CONSENT_COOKIE = "cookie_choice";
export const CONSENT_EVENT = "cookie-choice-changed";
export const OPEN_SETTINGS_EVENT = "open-cookie-settings";
export type CookieChoice = "all" | "essential";

export function readChoice(cookie = typeof document === "undefined" ? "" : document.cookie): CookieChoice | null {
  const m = cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=(all|essential)(?:;|$)`));
  return (m?.[1] as CookieChoice | undefined) ?? null;
}

export function writeChoice(choice: CookieChoice): void {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${choice}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** True only when the visitor said yes to the optional features. */
export const optionalAllowed = () => readChoice() === "all";
