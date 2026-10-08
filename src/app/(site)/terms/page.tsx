import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { ContactLine, legalIdentity } from "@/components/LegalPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  const { brand, operator } = legalIdentity();
  return (
    <LegalPage
      title="Terms of service"
      intro={<>These terms are the agreement between you and {operator} when you use {brand}. By creating an account, placing an order or using the website you agree to them. If you do not agree, please do not use it.</>}
    >
      <h2>1. What we do</h2>
      <p>
        {brand} helps people in Ghana buy from UK shops. You choose an item from a shop listed on the website, or send us a link to an item on another UK shop. We buy it for you in the UK,
        ship it to Ghana and deliver it to your address. We are not the maker or the seller of the items. Product names, photos and prices come from the UK sellers.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be 18 or over and give us true details, including a phone number we can reach you on.</li>
        <li>You can sign in with a phone number or email and a password, or with Google, Facebook or Apple. Keep your sign-in private. You are responsible for what happens under your account, so tell us at once if you think someone else has used it.</li>
        <li>We may switch off an account that breaks these terms or is used for fraud or abuse.</li>
      </ul>

      <h2>3. Prices and what you pay</h2>
      <ul>
        <li>Item prices are set in pounds by the UK seller. We show them in pounds and in cedis, using an exchange rate we set, which may include a small markup to cover rate changes between your order and our purchase.</li>
        <li>Your total is shown before you pay and covers the items, our service charge, shipping to Ghana and delivery to your address. If you pay by an international card, the charge may be made in pounds at the equivalent amount.</li>
        <li><strong>Import duty, customs charges and taxes</strong> in Ghana, if any, are not included in the total. If you are asked to pay them, you are responsible for them.</li>
        <li>Prices and stock on UK shops can change. The price we confirm to you before you pay is the price we use for your order.</li>
      </ul>

      <h2>4. Items from other UK shops (link requests)</h2>
      <p>
        If you send us a link, we check the price and stock and send you a quote with the full cost. A quote is valid until the date it shows. If the UK price or stock changes before we buy, we will contact
        you before going ahead, and you can cancel and be refunded. We can only quote what a shop shows us, so the price you type in is a guide until we confirm it.
      </p>

      <h2>5. Placing an order and paying</h2>
      <ul>
        <li>An order is accepted when your payment is confirmed. We start buying only after that.</li>
        <li>Payment is taken by our payment providers (for example Mobile Money, cards or bank payment). We do not see or keep your full card details.</li>
        <li>We may refuse or cancel an order, for example if an item is out of stock, the price was wrong, we suspect fraud, or we cannot deliver to your area. If we cancel an order you have paid for, we refund it.</li>
      </ul>

      <h2>6. Cancellations and refunds</h2>
      <ul>
        <li>You can ask to cancel an order until we have bought the item from the UK shop. Write to us at <ContactLine /> as soon as you can.</li>
        <li>After we have bought it, we cannot normally cancel, because the UK shop already has the order. If the shop accepts a return, we will help, but return costs may apply.</li>
        <li>If an order is cancelled after you paid, we refund you to the way you paid, and we will tell you the expected timing. Your bank or payment provider may take time to show it.</li>
        <li>If an item arrives damaged, wrong or missing, tell us within a reasonable time with photos if you can, and we will work with the seller and carriers to put it right.</li>
      </ul>

      <h2>7. Shipping and delivery</h2>
      <ul>
        <li>Your order passes through several steps (bought, received at our UK address, shipped to Ghana, customs, out for delivery). You can follow them under your account or on our tracking page.</li>
        <li>Dates we give are estimates, not promises. Customs, carriers and weather can cause delays that we do not control.</li>
        <li>You must give a delivery address and phone number we can use, and be reachable on delivery. If we cannot deliver because details are wrong or no one is reachable, extra costs may apply.</li>
        <li>Shipping cost is based on the weight and size of your parcel, so the final chargeable weight can differ from an estimate.</li>
      </ul>

      <h2>8. Things we cannot ship</h2>
      <p>
        We cannot buy or ship items that are illegal, restricted or dangerous, or that carriers or customs do not allow. If an order contains such an item we may cancel it and refund what you have paid for
        it. You are responsible for knowing whether an item can lawfully be brought into Ghana.
      </p>

      <h2>9. Reviews and how you use the website</h2>
      <ul>
        <li>Reviews must be honest and about the item or our service. We may remove reviews that are abusive, misleading or off topic.</li>
        <li>Do not misuse the website: no attempts to break into it, overload it, copy it in bulk, or use it for fraud.</li>
      </ul>

      <h2>10. Our content</h2>
      <p>
        The website, its design and our own text belong to {operator} or its licensors. Brand names, photos and product descriptions belong to the sellers and brands concerned. You may use the website for your
        own shopping, but not copy it for other purposes without our permission.
      </p>

      <h2>11. Our responsibility</h2>
      <p>
        We take care to do what we say. Nothing in these terms limits any right you have by law that cannot be limited. Subject to that, we are not responsible for losses we could not reasonably have
        expected, for delays caused by events outside our control (such as customs, carriers, strikes or weather), or for the quality or safety of items made by others beyond what the law requires.
        Our total responsibility to you for any one order is limited to the amount you paid for that order.
      </p>

      <h2>12. Your information</h2>
      <p>How we use your personal information is explained in our <Link className="link" href="/privacy">privacy policy</Link>. To delete your account see <Link className="link" href="/data-deletion">data deletion</Link>.</p>

      <h2>13. Changes to these terms</h2>
      <p>We may change these terms. We will update the date at the top, and changes apply to orders placed after that date. If you keep using the website after a change, you accept it.</p>

      <h2>14. Law and disputes</h2>
      <p>
        These terms are governed by the laws of Ghana, and the courts of Ghana can decide disputes, unless the law where you live gives you other rights that cannot be set aside. If something goes
        wrong, please contact us first at <ContactLine /> so we can try to fix it.
      </p>

      <h2>15. Contact</h2>
      <p>{operator}, <ContactLine />.</p>
    </LegalPage>
  );
}
