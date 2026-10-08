import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { ContactLine, legalIdentity } from "@/components/LegalPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Delete your data" };

export default function DataDeletionPage() {
  const { brand } = legalIdentity();
  return (
    <LegalPage
      title="Delete your data"
      intro={<>You can delete your {brand} account and the personal information tied to it at any time. This page explains how, what is removed, and what we must keep.</>}
    >
      <h2>Delete your account yourself</h2>
      <ol>
        <li><Link className="link" href="/login?next=%2Faccount%2Fsecurity">Sign in</Link> to your account.</li>
        <li>Open <strong>Account → Security</strong> and scroll to <strong>Delete my account</strong>.</li>
        <li>Type <strong>DELETE</strong> to confirm. If you set a password, you are also asked for it. If you joined with Google, Facebook or Apple and never chose a password, typing DELETE is enough.</li>
        <li>Press <strong>Delete my account</strong>. You are signed out and your account is removed straight away.</li>
      </ol>

      <h2>What is deleted</h2>
      <ul>
        <li>your profile (name, phone number, email) and notification choices;</li>
        <li>your saved delivery addresses and saved items;</li>
        <li>your sign-in sessions on all devices;</li>
        <li>the link to any Google, Facebook or Apple sign-in you used, so that provider can no longer open the account.</li>
      </ul>

      <h2>What we must keep</h2>
      <ul>
        <li>Orders you placed, with the delivery details you gave for them and the payment records, as business, tax and customs records. They are no longer linked to an account.</li>
        <li>Reviews you wrote stay, but are shown as &ldquo;Former customer&rdquo;.</li>
        <li>A record of messages we sent and security logs, for as long as we need them for support, fraud prevention and the law.</li>
      </ul>
      <p>Details of how long we keep things are in our <Link className="link" href="/privacy">privacy policy</Link>.</p>

      <h2>If you cannot sign in</h2>
      <p>
        Write to us at <ContactLine /> from the phone number or email on the account, and say that you want your account deleted. We may ask a question to check it is you. We will confirm
        when it is done.
      </p>

      <h2>If you used Google, Facebook or Apple</h2>
      <p>
        Removing {brand} from your Google, Facebook or Apple settings stops that provider sharing new information with us, but it does not delete your {brand} account. To delete the account,
        use the steps above or write to us. If you are asked to give a &ldquo;data deletion instructions URL&rdquo;, this page is it.
      </p>
    </LegalPage>
  );
}
