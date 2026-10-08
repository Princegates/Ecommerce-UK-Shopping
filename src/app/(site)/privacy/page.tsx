import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { ContactLine, legalIdentity } from "@/components/LegalPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  const { brand, operator, site } = legalIdentity();
  return (
    <LegalPage
      title="Privacy policy"
      intro={<>This explains what personal information {brand} collects, why, who we share it with, how long we keep it, and what you can ask us to do with it.</>}
    >
      <h2>1. Who we are</h2>
      <p>
        {brand} ({site}) is run by {operator}. We help people in Ghana buy from UK shops: we buy the item for you, ship it, and deliver it. For the personal information described
        here, {operator} decides how and why it is used. You can reach us at <ContactLine />.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li><strong>Your account:</strong> your name, phone number, optional email address, a password (kept only in scrambled form, so we cannot read it), your notification choices, saved delivery addresses, your chosen delivery area and your saved items.</li>
        <li><strong>If you sign in with Google, Facebook or Apple:</strong> the provider&rsquo;s own ID for you, and the name and email address they choose to share with us. We never see your password with them, and we do not post to your account or read your friends, contacts or messages.</li>
        <li><strong>Orders and link requests:</strong> what you ordered, links you send us, the name, phone number, delivery address and landmark you give, notes, amounts, the payment status and reference, and tracking updates.</li>
        <li><strong>Payments:</strong> are taken by our payment providers. We do not see or keep your full card number or Mobile Money PIN. We keep the amount, status and reference.</li>
        <li><strong>Messages we send you:</strong> order updates and password-reset links by SMS, WhatsApp or email, and a record of what was sent and to whom.</li>
        <li><strong>Reviews:</strong> if you leave one, it is shown with your first name and the first letter of your last name.</li>
        <li><strong>Technical information:</strong> your internet address, which we use briefly to limit abuse such as repeated sign-in attempts, and ordinary server logs kept by our hosting provider.</li>
      </ul>
      <p>You can browse and add items to a cart without an account. We ask you to create one (or sign in) to check out.</p>

      <h2>3. Cookies</h2>
      <p>We use only the cookies the shop needs to work:</p>
      <ul>
        <li>a sign-in cookie that keeps you signed in (up to 30 days);</li>
        <li>a cart cookie that remembers your basket;</li>
        <li>a cookie that remembers the delivery area you chose;</li>
        <li>short-lived cookies (minutes) used while you sign in with Google, Facebook or Apple, so a sign-in can only be finished in the browser that started it;</li>
        <li>a staff sign-in cookie, for our team only.</li>
      </ul>
      <p>We do not use advertising cookies, analytics trackers or third-party tracking on this website.</p>

      <h2>4. How we use your information, and why</h2>
      <ul>
        <li>to take and process your orders, buy your items, ship them and deliver them (to carry out our contract with you);</li>
        <li>to take payment and handle refunds;</li>
        <li>to send you updates about your orders, and password-reset links, in the ways you have chosen (you can change these in your account);</li>
        <li>to give you support, and to resolve problems and disputes;</li>
        <li>to keep the shop secure and prevent fraud and abuse (our legitimate interest);</li>
        <li>to keep the business, tax and customs records the law requires.</li>
      </ul>
      <p>We do not sell your personal information, and we do not use it for advertising.</p>

      <h2>5. Who we share it with</h2>
      <ul>
        <li><strong>Payment providers</strong> (such as Paystack, Flutterwave and Stripe, depending on which we use), to take your payment.</li>
        <li><strong>Messaging providers</strong> that send our SMS, WhatsApp and email messages.</li>
        <li><strong>UK shops and couriers</strong> we use to buy and move your items. This is normally only the item and our UK delivery address, and your name where a shop or carrier needs it.</li>
        <li><strong>Freight and delivery partners</strong> that bring your order to you, who need your name, phone number and delivery address.</li>
        <li><strong>Our hosting and technology providers</strong>, who store and process data for us under their agreements with us.</li>
        <li><strong>Google, Facebook or Apple</strong>, when you choose to sign in with them. Their own privacy policies apply to what they do.</li>
        <li><strong>Authorities and advisers</strong>, where the law requires it or to protect our rights, and a buyer if the business is ever sold.</li>
      </ul>

      <h2>6. Where your information goes</h2>
      <p>
        Your information may be stored and processed in Ghana, the United Kingdom and other countries where our providers operate. Where we send it abroad, we do so only to
        providers who are bound to protect it.
      </p>

      <h2>7. How long we keep it</h2>
      <ul>
        <li>Your account details are kept until you delete your account.</li>
        <li>Orders, payment records and the delivery details given for them are kept as business, tax and customs records even after you delete your account. They are no longer linked to an account.</li>
        <li>A record of messages sent, and security logs, are kept for as long as we need them for support, fraud prevention and the law.</li>
      </ul>

      <h2>8. Your choices and rights</h2>
      <p>You can ask us to:</p>
      <ul>
        <li>show you the personal information we hold about you;</li>
        <li>correct it (most of it you can edit yourself under <Link className="link" href="/account/profile">Account</Link>);</li>
        <li>delete it, apart from what we must keep (see section 7). The steps are on our <Link className="link" href="/data-deletion">data deletion page</Link>;</li>
        <li>stop using it for a purpose you agreed to, for example turning off SMS, WhatsApp or email updates in your account.</li>
      </ul>
      <p>
        Write to us at <ContactLine /> and we will reply as soon as we reasonably can. We may ask you to prove who you are first. If you are not happy with how we handle your information, you
        can complain to the Data Protection Commission of Ghana, or to the data protection authority where you live.
      </p>

      <h2>9. Keeping it safe</h2>
      <p>
        Passwords are stored in scrambled form. The website uses an encrypted (HTTPS) connection, keys for outside services are stored encrypted, and our team can see only what their role needs.
        No system is perfectly secure, so please keep your password private and sign out on shared devices.
      </p>

      <h2>10. Children</h2>
      <p>{brand} is for people aged 18 and over. We do not knowingly collect information from children.</p>

      <h2>11. Changes</h2>
      <p>If we change this policy we will update the date at the top. If the change is important we will tell you in your account or by message.</p>

      <h2>12. Contact</h2>
      <p>{operator}, <ContactLine />. See also our <Link className="link" href="/terms">terms of service</Link>.</p>
    </LegalPage>
  );
}
