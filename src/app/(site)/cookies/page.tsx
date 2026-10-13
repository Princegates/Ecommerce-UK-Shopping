import type { Metadata } from "next";
import Link from "next/link";
import CookieSettingsLink from "@/components/CookieSettingsLink";
import LegalPage, { ContactLine, legalIdentity } from "@/components/LegalPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cookie policy" };

const ESSENTIAL: [name: string, what: string, lasts: string][] = [
  ["sid", "Keeps you signed in to your account.", "30 days, or until you sign out"],
  ["cart", "Remembers the items in your basket.", "30 days"],
  ["dz", "Remembers the delivery area you chose, so prices show what it costs to your door.", "12 months"],
  ["oauth_bind, social_signup", "Used only while you sign in with Google, Facebook or Apple, so a sign-in can only be finished in the browser that started it.", "10 to 30 minutes"],
  ["cookie_choice", "Remembers the choice you make in the cookie banner.", "12 months"],
  ["admin_session", "Staff sign-in, for our team only. You will never have this one.", "8 hours"],
];

export default function CookiesPage() {
  const { brand } = legalIdentity();
  return (
    <LegalPage
      title="Cookie policy"
      intro={<>Cookies are small files a website saves in your browser. This page lists the ones {brand} uses, what each one is for, and how to change your choice.</>}
    >
      <h2>1. Cookies the shop needs to work</h2>
      <p>These are always on, because the shop cannot work without them. They do not track you around other websites, and you do not need to agree to them.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>What it does</th><th>How long it lasts</th></tr></thead>
          <tbody>
            {ESSENTIAL.map(([n, w, l]) => (
              <tr key={n}><td className="mono whitespace-nowrap">{n}</td><td>{w}</td><td>{l}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>2. Optional: recently viewed items</h2>
      <p>
        If you choose <strong>Accept all</strong>, the shop remembers the last few items you looked at, in your browser&rsquo;s own storage (not a cookie), so it can show them to you again as &ldquo;Recently viewed&rdquo;.
        It stays on your device. We do not receive it. If you choose <strong>Essential only</strong>, nothing is saved and anything already saved is removed.
      </p>

      <h2>3. What we do not use</h2>
      <p>We do not use advertising cookies, analytics trackers or social-media tracking pixels. If that ever changes, we will update this page and ask you again before they are switched on.</p>

      <h2>4. Change your choice</h2>
      <p>
        You can change your choice at any time: <CookieSettingsLink className="link font-semibold" />. You can also delete cookies in your browser&rsquo;s settings. If you do, you will be signed out and your basket may be emptied.
      </p>

      <h2>5. Questions</h2>
      <p>
        See our <Link className="link" href="/privacy">privacy policy</Link> for how we handle your personal information, or contact us: <ContactLine />.
      </p>
    </LegalPage>
  );
}
