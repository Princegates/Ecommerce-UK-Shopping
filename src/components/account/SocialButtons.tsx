import { SOCIAL_LABEL, type SocialProviderId } from "@/lib/social/providers";
import { SOCIAL_ERROR_TEXT, isSocialErrorCode } from "@/lib/social/cookies";

const ICON: Record<SocialProviderId, React.ReactNode> = {
  google: (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  ),
  facebook: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 10-13.9 11.9v-8.4H7.100V12h3V9.400c0-3 1.800-4.700 4.500-4.700 1.300 0 2.700.2 2.700.2v3h-1.500c-1.500 0-2 .9-2 1.900V12h3.400l-.5 3.500h-2.900v8.400A12 12 0 0024 12z" />
    </svg>
  ),
  apple: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16.400 12.600c0-2.400 2-3.500 2.100-3.600-1.100-1.700-2.900-1.900-3.500-1.900-1.500-.2-2.900.9-3.700.9-.8 0-1.900-.9-3.200-.8-1.600 0-3.100 1-4 2.400-1.700 3-.4 7.400 1.200 9.800.8 1.200 1.800 2.500 3 2.400 1.200 0 1.700-.8 3.100-.8 1.500 0 1.900.8 3.200.8 1.300 0 2.100-1.200 2.900-2.300.9-1.300 1.300-2.600 1.300-2.700-.1 0-2.400-.9-2.400-3.600zM14 5.500c.7-.8 1.100-1.900 1-3-1 0-2.100.7-2.800 1.500-.6.700-1.200 1.800-1 2.900 1.100.1 2.100-.6 2.800-1.400z" />
    </svg>
  ),
};

/** "Continue with Google / Facebook / Apple". Plain links, so they work without any script. Renders nothing when none is set up. */
export default function SocialButtons({ providers, next, link = false, verb = "Continue with" }: { providers: SocialProviderId[]; next?: string; link?: boolean; verb?: string }) {
  if (providers.length === 0) return null;
  const href = (p: SocialProviderId) => {
    const q = new URLSearchParams();
    if (link) q.set("link", "1");
    else if (next) q.set("next", next);
    const s = q.toString();
    return `/api/auth/${p}/start${s ? `?${s}` : ""}`;
  };
  return (
    <div className="grid gap-3">
      {providers.map((p) => (
        <a key={p} href={href(p)} className="btn w-full justify-center gap-3" rel="nofollow">
          {ICON[p]}
          <span>{verb} {SOCIAL_LABEL[p]}</span>
        </a>
      ))}
    </div>
  );
}

export function SocialDivider() {
  return (
    <p className="my-5 flex items-center gap-3 text-sm text-ink-soft" role="separator">
      <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
    </p>
  );
}

export function SocialErrorNote({ code }: { code?: string }) {
  if (!isSocialErrorCode(code)) return null;
  return <p role="alert" className="box mb-4 border-red bg-red/10 p-3 text-sm font-semibold text-red">{SOCIAL_ERROR_TEXT[code]}</p>;
}
