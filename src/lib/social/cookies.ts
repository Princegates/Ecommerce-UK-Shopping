const secure = () => process.env.NODE_ENV === "production";

/** The __Host- prefix makes browsers refuse the cookie unless it is Secure, path=/ and has no Domain. */
export const bindCookieName = () => (secure() ? "__Host-oauth_bind" : "oauth_bind");
export const signupCookieName = () => (secure() ? "__Host-social_signup" : "social_signup");

/**
 * Apple returns the person to us with a cross-site POST, which browsers send no SameSite=Lax cookie on, so the cookie that ties an
 * attempt to the browser that began it must be SameSite=None (allowed only when Secure). In development over http it stays Lax.
 */
export const bindCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true, secure: secure(), sameSite: (secure() ? "none" : "lax") as "none" | "lax", path: "/", maxAge: maxAgeSeconds,
});

/** To remove a cookie, set it again with an immediate expiry and the same attributes: browsers ignore the removal of a Secure or __Host- cookie that lacks them. */
export const expiredBindCookie = () => ({ name: bindCookieName(), value: "", ...bindCookieOptions(0) });
export const expiredSignupCookie = () => ({ name: signupCookieName(), value: "", ...signupCookieOptions(0) });

export const signupCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true, secure: secure(), sameSite: "lax" as const, path: "/", maxAge: maxAgeSeconds,
});

export type SocialErrorCode = "cancelled" | "failed" | "expired" | "disabled" | "email_in_use" | "already_linked" | "unavailable";

export const SOCIAL_ERROR_TEXT: Record<SocialErrorCode, string> = {
  cancelled: "Sign-in was cancelled. You can try again, or use your phone or email and password.",
  failed: "We could not complete that sign-in. Please try again, or use your phone or email and password.",
  expired: "That sign-in took too long or came from a different browser. Please start again.",
  disabled: "This account is switched off. Contact support if you think that is a mistake.",
  email_in_use: "An account with that email already exists. Sign in with your password (or another method), then connect it from Account > Security.",
  already_linked: "That account is already connected to a different customer on this site.",
  unavailable: "That sign-in method is not available right now.",
};

export const isSocialErrorCode = (v: unknown): v is SocialErrorCode => typeof v === "string" && v in SOCIAL_ERROR_TEXT;
