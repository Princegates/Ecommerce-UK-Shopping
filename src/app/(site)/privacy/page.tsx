import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";
import { policyBySlug } from "@/lib/policies";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <PolicyPage
      policy={policyBySlug("privacy")!}
      after={
        <>
          <h2>How this website handles your information</h2>
          <ul>
            <li><strong>Signing in with Google, Facebook or Apple.</strong> We receive the provider&rsquo;s own ID for you, and the name and email address they choose to share with us. We never see your password with them, and we do not post to your account or read your friends, contacts or messages.</li>
            <li><strong>Reviews.</strong> If you leave a review it is shown with your first name and the first letter of your last name.</li>
            <li><strong>Passwords and abuse limits.</strong> Your password is kept only in scrambled form. We use your internet address briefly to limit abuse such as repeated sign-in attempts, and our hosting provider keeps ordinary server logs.</li>
            <li><strong>No advertising or analytics trackers.</strong> This website sets only the cookies it needs, plus an optional &ldquo;recently viewed&rdquo; memory in your own browser if you choose &ldquo;Accept all&rdquo;. The full list is on the <Link className="link" href="/cookies">cookie policy</Link>.</li>
            <li><strong>Deleting your data.</strong> The steps are on the <Link className="link" href="/data-deletion">data deletion page</Link>.</li>
          </ul>
        </>
      }
    />
  );
}
