/**
 * The customer-facing policies, as supplied by the business in its Policy Pack (effective 1 November 2026). The text is the business's own;
 * keep wording changes to this file so every page that shows a policy stays in step.
 *
 * Policies 15 (information security), 16 (partner management) and 17 (staff code of conduct) are internal and are not published on the
 * website: see docs/14-internal-policies.md.
 *
 * Three statements were adjusted from the supplied pack because the website does not do what they said (see `NOTES` below).
 */
export const POLICY_EFFECTIVE = "1 November 2026";

export const COMPANY = {
  uk: "Atombo Logistics Ltd, 16904987, 167 - 169 Great Portland Street, 5th Floor. London. W1W 5PF",
  gh: "Atombo Logistics Limited Company, TIN: C0067080804, Hse No. 6 Dome-Kwabenya, Aksu Link, Accra",
  email: "info@atombologistics.com",
  phones: "+447749690339 / +233546316337",
};

export type Clause = {
  /** The number shown, such as "1.6" */
  n: string;
  /** The bold lead-in, such as "Price and currency." */
  head?: string;
  text?: string;
  items?: string[];
  table?: { cols: string[]; rows: string[][] };
};

export type Policy = {
  /** The number in the pack: "Policy 5" */
  no: number;
  slug: string;
  title: string;
  /** shown above the clauses */
  intro?: string;
  clauses: Clause[];
};

const c = (n: string, head: string, text: string): Clause => ({ n, head, text });

export const POLICIES: Policy[] = [
  {
    no: 1,
    slug: "terms",
    title: "Terms and Conditions of Service",
    intro: "UK-to-Ghana shop-and-ship service",
    clauses: [
      c("1.1", "About us.", `YenkoExpress (“we”, “us”) is a trading name of ${COMPANY.uk} and ${COMPANY.gh}. Contact: ${COMPANY.email}, ${COMPANY.phones}.`),
      c("1.2", "These terms.", "These Terms, the Privacy Policy, the Cookie Policy and policies 2 to 13 govern every order. You accept them when you create an account, pay for an order, or instruct us (including by WhatsApp or SMS) to buy or ship an item. If you do not accept them, do not use the service. “Working day” means Monday to Saturday, excluding public holidays where the step takes place."),
      c("1.3", "Our service.", "You choose items from UK retailers or paste a product link. We buy them as your agent, receive them at our UK hub, export them, clear them through Ghana Customs and deliver them to your door in Ghana. The retailer is the seller of the goods; we are your purchasing and shipping agent. We may use agents, couriers and licensed customs brokers, and consolidate your goods with others."),
      c("1.4", "Eligibility and account.", "You are 18 or over and give us accurate details, including a Ghana delivery address and a phone number we can reach. Keep your login secure. You are responsible for activity on your account. One account per person."),
      c("1.5", "Placing an order.", "Your order instructs us to buy for you. We accept it when we have bought the item. Before that we may decline or cancel it for stock, price change, restricted item, pricing error or a failed fraud check, and refund you in full."),
      c("1.6", "Price and currency.", "All prices and payments are in Ghana cedis (GH₵). The checkout price is the full price for the item delivered to your door in Ghana: it includes the item, our service, international shipping, cargo insurance, import duties and taxes, and delivery to your zone. You pay nothing more on delivery. Pound amounts, where shown, are for information only. Your quote is locked for the time shown at checkout; after that we refresh it."),
      c("1.7", "Price changes.", "We may change prices at any time. A price you have paid will not change unless clause 1.8 or 5.3 applies."),
      c("1.8", "Retailer changes and re-quotes.", "If the retailer changes the price or the item becomes unavailable before we buy, we tell you. You may pay the difference, accept an alternative or cancel for a full refund. If the details you gave us were wrong or incomplete (link, size, quantity, category or weight), we may re-quote; you may then pay the difference or cancel before dispatch."),
      c("1.9", "Payment.", "You pay by mobile money or card through our payment partners. We never see or store your card details. Your order starts when payment is confirmed. We may hold or return payments of the wrong amount or made by someone else."),
      c("1.10", "Custody, delivery and risk.", "Delivery times are estimates, not guarantees (Policy 4). Goods are in our custody from the moment they are received at our UK hub until they are delivered to you or collected. Before that they are with the retailer or its courier, and we pursue them on your behalf. Risk passes to you on delivery. While in our custody the goods are insured (Policy 6)."),
      c("1.11", "Duties and taxes.", "Import duties and taxes are included in your price (Policy 5). If customs assesses more because you gave us wrong information or the item was misdescribed, we may charge you the difference."),
      c("1.12", "Prohibited and restricted items.", "You must not order them (Policy 7). We may refuse, cancel or hold any order and report it to the authorities."),
      c("1.13", "Returns and refunds.", "Policy 8 applies. Because goods travel internationally, change-of-mind returns are limited once an item has left our UK hub. Rights the law does not let us exclude are unaffected."),
      c("1.14", "Your responsibilities.", "Give a correct delivery address and an answerable phone number. Be available for delivery and inspect your parcel on receipt (Policy 11). Provide ID when we ask (Policy 11). Order for personal use unless you hold an approved trader account (clause 1.24), and do not use the service for unlawful purposes or to abuse our staff, riders or partners."),
      c("1.15", "Product information.", "Descriptions, images and specifications come from retailers. Manufacturer warranties may not apply in Ghana, and UK electrical goods may need adaptors. Check before you order. Where a retailer offers a remedy we pass it on."),
      c("1.16", "Our liability.", "We are liable for loss or damage while goods are in our custody (clause 1.10), assessed as set out in Policy 6, up to the price you paid for that order. Nothing limits our liability for fraud, for death or personal injury caused by our negligence, or for anything the law does not allow us to limit. We are not liable for indirect or consequential loss, for goods seized because they are prohibited or wrongly described by the retailer, for manufacturer defects, or for delays outside our control (clause 1.19)."),
      c("1.17", "Intellectual property and scraping.", "The site, brand and content belong to us or our licensors. You may use them for your own orders only. You must not scrape, copy or systematically collect our prices, quotes or content, or use bots or automated tools on the site."),
      c("1.18", "Suspension.", "We may suspend or close an account and cancel orders for fraud, abuse, breach of these Terms or suspected unlawful activity."),
      c("1.19", "Events beyond our control.", "We are not liable for delay or failure caused by events outside our reasonable control, including flight cancellations, strikes, customs holds, port or airport disruption, power or network failure, and acts of government."),
      c("1.20", "Communications.", "We contact you by SMS, WhatsApp, email and in-app messages about your orders. We send marketing only with your consent."),
      c("1.21", "Changes to these Terms.", "We post changes on the site. The Terms in force when you order apply to that order."),
      c("1.22", "General.", "These Terms are the whole agreement between us about the service. If a clause is unenforceable the rest still applies. We may transfer our rights to a successor; you may not without our consent."),
      c("1.23", "Law and disputes.", "Governing law: England and Wales. If you are a consumer, nothing in these Terms removes the mandatory protections of the law where you live or your right to bring proceedings there. For business customers the courts of England and Wales have exclusive jurisdiction. Complaints follow Policy 10."),
    ],
  },
  {
    no: 2,
    slug: "pricing-and-payment",
    title: "Pricing, Currency and Payment Policy",
    clauses: [
      c("2.1", "One price.", "The price at checkout is the total you pay. It already includes your item, our service, shipping, cargo insurance, import duties and taxes, and delivery to your zone. We never ask for payment on delivery unless the duty exceeds what you disclosed."),
      c("2.2", "Cedi pricing and exchange rates.", "We price in Ghana cedis using live exchange rates. The rate is locked when your quote is created, for the time shown on screen. If the lock expires you see a refreshed price before you pay."),
      c("2.3", "What affects your price.", "The item price, the exchange rate, the weight and size of your goods, the product category, your delivery zone and our service costs. Shipping weight is the greater of actual weight and volumetric weight."),
      c("2.4", "Minimum order.", "A minimum order value applies. It is shown at checkout."),
      // adjusted: the pack names Eversend, which the website does not use
      c("2.5", "Payment.", "Mobile money, Visa and Mastercard through our payment partners. Payment costs are inside the price; we add no card surcharge."),
      c("2.6", "Changes before purchase.", "If the retailer’s price changes, the item is unavailable or the details you gave us were wrong, we contact you. You can pay the difference at your original rate, accept a substitute or cancel for a refund of anything not yet spent."),
      c("2.7", "Pricing errors.", "If we spot a pricing error we may cancel before we buy and refund you in full."),
      c("2.8", "Receipts.", "You get an electronic receipt for every order showing your items, delivery and import charges, and total."),
    ],
  },
  {
    no: 3,
    slug: "ordering-and-purchasing",
    title: "Ordering and Purchasing Policy",
    clauses: [
      c("3.1", "Paste-a-link orders.", "We quote from the retailer’s price at that moment. Before buying we check item, size, colour, seller and condition. New, used or refurbished is always shown."),
      c("3.2", "Approved sellers.", "We buy from listed UK retailers and from marketplace sellers that meet our standard. We may decline any link."),
      c("3.3", "Speed.", "We aim to buy within one working day of payment."),
      c("3.4", "Retailer cancels.", "If a retailer cancels or cannot deliver, you get a full refund."),
      c("3.5", "Before you order.", "Check size, voltage and plug compatibility, and warranty. UK manufacturer warranties may not apply in Ghana. We offer no warranty beyond the retailer’s and manufacturer’s terms."),
    ],
  },
  {
    no: 4,
    slug: "shipping-and-delivery",
    title: "Shipping and Delivery Policy",
    clauses: [
      c("4.1", "Service.", "Items go to our UK hub, are consolidated weekly and fly to Accra by air freight. Heavy or bulky goods (over 30 kg or 150 cm) are quoted separately and may go by sea."),
      c("4.2", "Estimated time.", "Express (air) normally takes 7–14 working days from payment: retailer to UK hub 1–5 days, weekly consolidation, flight and customs clearance 3–5 days, delivery 1–2 days. Economy (sea), offered for heavier or bulkier orders, normally takes 6–8 weeks from the vessel’s sailing date, which can be one to two weeks after we receive your goods. These are estimates, not guarantees."),
      c("4.3", "Chargeable weight.", "Chargeable weight is the greater of actual weight and volumetric weight (length × width × height in cm ÷ 5,000), rounded up to the next 0.5 kg. We weigh at our hub. If the final chargeable weight differs from the quote by more than 10%, we bill or refund the difference and tell you before dispatch."),
      c("4.4", "Consolidation.", "Items bought separately can ship together once all arrive, or earlier on request. Each separate shipment pays the minimum shipping charge."),
      c("4.5", "Tracking.", "You get SMS, WhatsApp or email updates at: Paid, Purchased, Received at UK hub, Dispatched, In Ghana and clearing, Out for delivery, Delivered."),
      c("4.6", "Delivery in Ghana.", "We deliver to Accra zones (East Legon and Airport, Accra Central, Tema and Spintex, Kasoa and West Accra) and to other regions by partner courier. The delivery charge for your zone is included in your price. Collecting from our pickup point may lower your price."),
      c("4.7", "Handover and inspection.", "We call before delivery. The receiver gives a one-time delivery code, and someone else may collect only with the code. Check the parcel in front of the rider and, where practicable, its contents. Note visible damage or shortage on the delivery record before the rider leaves. A signature or code given without notes is evidence that no visible damage was apparent, but it does not stop a claim for concealed damage reported within 48 hours (Policy 8). We do not leave goods unattended unless you authorise a safe place, and then our responsibility ends when they are left there. We attempt delivery twice; after that Policy 12 applies and a re-delivery fee."),
      c("4.8", "Delays.", "We tell you about delays we know of. If your parcel has not arrived within 30 working days of payment you may cancel and receive a refund, unless customs is holding it for a reason connected to you or the item."),
      c("4.9", "Proof of delivery", "(time, code, photo) is kept for 12 months."),
      c("4.10", "Hub record.", "We photograph each parcel when it reaches our UK hub and record serial numbers of phones, laptops and other significant electronics. Records are kept for 12 months and used in claims. You can ask for yours."),
      c("4.11", "Repacking and fragile items.", "We may repack or reinforce items for transit. Fragile goods (glass, ceramics, mirrors, televisions, lighting) are accepted only if we can protect them adequately, and we may refuse or re-quote if we cannot. Damage to items already damaged or poorly packed by the retailer is dealt with under Policy 6.4."),
      c("4.12", "Partial delivery.", "If only part of your order is available we may deliver it in parts and tell you what is outstanding. Separate dispatch at your request is charged under clause 4.4."),
    ],
  },
  {
    no: 5,
    slug: "customs-duties-and-taxes",
    title: "Customs, Duties and Taxes Policy",
    clauses: [
      c("5.1", "Duties and taxes are included.", "Goods entering Ghana attract customs duty, import VAT and levies assessed by the Ghana Revenue Authority through ICUMS. We work these out at checkout and include them in your price. You pay nothing more on delivery, and nobody acting for us will ask you for money at the door."),
      c("5.2", "How we estimate.", "We calculate by product category using current Ghana tariff rules. Goods are cleared by licensed customs agents."),
      c("5.3", "If customs assesses more or less.", "The difference, in either direction, is ours. We ask you for more only if the item was misdescribed, the information you gave was wrong, or you changed the order (for example by adding items)."),
      c("5.4", "Honest declaration.", "We declare the price actually paid and the true description. We do not under-declare, split consignments or mislabel goods, and we refuse requests to do so."),
      c("5.5", "Seizure or detention.", "We are not liable for goods seized because of the item’s nature or the retailer’s paperwork. We help with appeals."),
      c("5.6", "Documents.", "We may need your TIN or Ghana Card number for customs on high-value items."),
      c("5.7", "Importer of record.", "Atombo Logistics Limited Company, through its licensed customs agent, is the importer and declarant for your consignment and is responsible to the Ghana Revenue Authority for the declaration and for paying duties and taxes. You are not asked to act as importer."),
    ],
  },
  {
    no: 6,
    slug: "cargo-insurance-and-claims",
    title: "Cargo Insurance and Claims Policy",
    clauses: [
      c("6.1", "Why.", "Under Section 222 of the Insurance Act, 2021 (Act 1061), imported cargo must carry marine cargo insurance placed with an insurer licensed by the National Insurance Commission (NIC). The Ghana Revenue Authority enforces this from 1 October 2026. Every YenkoExpress consignment is insured under our policy with our insurer. You need no separate cover."),
      c("6.2", "Cover.", "All-risks cover (Institute Cargo Clauses A or equivalent) from receipt at our UK hub to delivery in Ghana. Sum insured: goods value plus shipping plus 10%."),
      c("6.3", "What it costs.", "Cargo insurance is included in your price. You pay no separate premium."),
      c("6.4", "Not covered.", "Delay; inherent defect or ordinary wear; perishable goods; leakage from liquids or contents packed by the retailer; weak packing by the seller; prohibited items; goods seized by authorities; loss caused by the customer’s wilful act or false information; items with no proof of value."),
      c("6.5", "Claim.", "Report visible damage on delivery or within 48 hours, and non-delivery within 30 days of the expected date. Send your order number, photos or video of the parcel and the unboxing, and your delivery code. Keep the item and packaging until the claim closes; we may refuse a claim if you dispose of or alter them before we can inspect."),
      c("6.6", "Process.", "We acknowledge within 2 working days, file with the insurer and our partners, and aim to decide within 15 working days of a complete claim. Settlement follows clause 6.9, and we bear any insurer excess."),
      c("6.7", "Escalation.", "After our internal process you may complain to the NIC complaints bureau."),
      c("6.8", "Evidence.", "We give you the insurance certificate reference on request."),
      c("6.9", "Valuation and salvage.", "We settle by repair, replacement with an equivalent item, or refund of the price paid, whichever is reasonable. You are not put in a better position than before the loss. Value is shown by our order record. Where we pay the full value for a damaged item, we or the insurer may take it as salvage; where it cannot reasonably be returned from Ghana, we may settle without taking it back."),
    ],
  },
  {
    no: 7,
    slug: "prohibited-and-restricted-items",
    title: "Prohibited and Restricted Items",
    clauses: [
      c("7.1", "Prohibited", "(we will not buy or ship): illegal drugs and controlled medicines; weapons, ammunition, explosives; counterfeit or pirated goods; cash, bullion, negotiable instruments; flammable or pressurised goods (including most aerosols and bulk perfume); loose lithium batteries and power banks; tobacco, vaping liquids and alcohol; indecent material; live animals; perishable food; hazardous chemicals; anything banned by UK export or Ghana import law."),
      c("7.2", "Restricted", "(case by case, may need permits or extra checks): medicines, medical devices (including TENS and similar units), cosmetics and food supplements (Ghana FDA rules), electronics with built-in batteries (packed per air-cargo rules; loose batteries and power banks stay prohibited), watches, jewellery and other high-value items (photographed and ID-checked), branded goods with authenticity risk, and items over weight or size limits."),
      c("7.3", "", "We may refuse or cancel any order, hold goods and report to authorities. If a prohibited item is found after dispatch, you bear the costs and no refund is due for items seized."),
      c("7.4", "", "This list is reconciled with our airline and forwarder dangerous-goods rules and updated when they change."),
    ],
  },
  {
    no: 8,
    slug: "returns-cancellations-and-refunds",
    title: "Returns, Cancellations and Refunds",
    clauses: [
      c("8.1", "Stage 1, before we buy.", "Cancel any time for a full refund."),
      c("8.2", "Stage 2, bought and still in the UK.", "We ask the retailer to take the item back. If it agrees, we refund the item price you paid less any retailer return fee, plus any shipping, insurance and import charges not yet incurred. The retailer’s decision and timing apply."),
      c("8.3", "Stage 3, dispatched from our UK hub.", "Once an item has left the UK it is in international transit or in Ghana, and duty paid to the Ghana Revenue Authority cannot be recovered. From this point we do not accept change-of-mind returns, and delivery and import charges are not refundable."),
      c("8.4", "What we do cover.", "If your item is lost, arrives damaged, is not the item you ordered or is dead on arrival, we put it right with a replacement, a refund of the item price or a part refund, at our choice. For lost goods we also refund the delivery and import charges for that item."),
      c("8.5", "How to claim.", "Report within 48 hours of delivery (7 days for a fault in electronics) with photos or an unboxing video and your delivery code. Do not use, wash or remove tags, and keep the packaging. For non-delivery, report within 30 days of the expected date."),
      c("8.6", "How we decide.", "We acknowledge within 2 working days and decide within 15 working days of a complete claim. Where returning the item would cost more than it is worth, we settle without a return. Where a return makes sense we may ask you to hold the item for collection. Repeated or suspicious claims are reviewed."),
      c("8.7", "Not covered.", "Change of mind after dispatch; perishable goods; opened personal-care items; underwear; personalised, digital or final-sale items; damage caused after delivery; items that match the order but differ from your expectation (size, colour shade, taste)."),
      c("8.8", "Refund method and timing.", "Refunds go to your original payment method in cedis, at the rate you paid, within 7 working days of approval (mobile money usually 1 to 3 days). The maximum refund is the price paid for the affected item."),
      c("8.9", "Your rights.", "Nothing here affects rights the law does not allow us to exclude."),
      c("8.10", "False claims.", "Claims must be truthful. A genuine claim we cannot prove is not treated as fraud. If we have reasonable evidence that a claim was knowingly false or fabricated, we may reject it, suspend the account, recover our reasonable losses and report it to the authorities."),
      c("8.11", "Returns to the UK.", "Return shipping is not included in your price. Where a return is agreed, you pay all return freight, customs, storage and handling in advance unless we agree otherwise in writing. A return is subject to customs, carrier and legal requirements and may not be possible."),
    ],
  },
  {
    no: 9,
    slug: "privacy",
    title: "Privacy Policy",
    // clause 9.1 is built at render time (see privacyClauses) because it carries the registration numbers, when there are any
    clauses: [
      c("9.2", "What we collect.", "Account details (name, phone, email, password hash); delivery details (address, landmark, receiver name and phone); order details (items, links, prices, payment references but never full card numbers); delivery proof (time, one-time code, photo); messages with us; device, log and usage data; and, only when customs, insurance or fraud checks require it, ID details and your TIN or Ghana Card number."),
      c("9.3", "Where it comes from.", "You; your payment provider (confirmation and masked payer name); delivery partners (status and proof); and our fraud and device checks."),
      {
        n: "9.4", head: "Why we use it, and our legal basis.",
        items: [
          "Buy, ship, clear and deliver your order, and handle claims: contract.",
          "Customs, tax, insurance, accounting and anti-money-laundering duties: legal obligation.",
          "Fraud prevention, security, service improvement and debt recovery: legitimate interest.",
          "Marketing messages and non-essential cookies: your consent, which you can withdraw at any time.",
        ],
      },
      c("9.5", "Who sees it.", "Payment and FX providers; the UK retailer or seller; our freight forwarder and airline; Ghana customs agents and the Ghana Revenue Authority; delivery riders and couriers (name, phone and address only); our insurer and broker; IT, messaging and analytics providers; professional advisers; and authorities where the law requires. We do not sell personal data. Providers act on our instructions under contract."),
      c("9.6", "Transfers abroad.", "Your data moves between Ghana and the UK, and may be processed by providers elsewhere. We use contracts and safeguards that meet both countries’ laws."),
      c("9.7", "How long we keep it.", "Order, customs and tax records: 6 years. Account data: while your account is open and 12 months after. ID checks: 12 months unless the law requires longer. Delivery photos: 12 months. Marketing consent: until you withdraw it. Support messages: 24 months."),
      c("9.8", "Your rights.", `You may ask to access, correct, delete or move your data, restrict or object to some uses, and withdraw consent. Use the data-deletion page or email ${COMPANY.email}. We reply within 30 days. We may keep what the law requires us to keep.`),
      c("9.9", "Marketing.", "We send offers only if you opt in. Every message has an unsubscribe option, or reply STOP."),
      c("9.10", "Fraud screening.", "We score orders for risk using order, payment and device signals. A person reviews anything we hold or decline. You can ask us to reconsider."),
      // adjusted: the pack also lists MFA for staff, which the website does not have yet
      c("9.11", "Security.", "Encryption in transit and at rest, role-based access for staff and the admin area, and monitoring."),
      c("9.12", "Breaches.", "If a breach puts you at risk we tell you and the regulators without undue delay, and the ICO within 72 hours where the UK GDPR applies."),
      c("9.13", "Children.", "The service is for people aged 18 and over. We do not knowingly collect children’s data."),
      c("9.14", "Cookies.", "See the Cookie Policy (Policy 13)."),
      c("9.15", "Complaints.", `Contact us first at ${COMPANY.email}. You may also complain to the Data Protection Commission (Ghana) or the ICO (UK).`),
      c("9.16", "Changes.", "We post updates here and tell you about material changes."),
    ],
  },
  {
    no: 10,
    slug: "complaints",
    title: "Complaints and Dispute Resolution",
    clauses: [
      c("10.1", "", `Contact ${COMPANY.email} / ${COMPANY.phones}. We acknowledge within 2 working days and aim to resolve within 15 working days.`),
      c("10.2", "", "If unresolved, ask for review by a director, who replies within 10 working days."),
      c("10.3", "", "Insurance claim disputes: NIC complaints bureau. Payment disputes: your card issuer or mobile money provider."),
      c("10.4", "", "We offer mediation before court. Statutory rights are unaffected."),
      c("10.5", "", "Social media posts and online reviews are not formal complaints; please also contact us directly so we can investigate. You are free to leave honest reviews, take independent advice or complain to a regulator. We reserve our rights where someone knowingly publishes false statements."),
    ],
  },
  {
    no: 11,
    slug: "fraud-id-and-aml",
    title: "Fraud, ID Verification and AML Policy",
    clauses: [
      c("11.1", "", "We screen orders for risk: new account, high value, mismatched names, repeated failed payments, unusual addresses."),
      c("11.2", "ID check triggers:", "first order above GH₵3,000, more than GH₵10,000 in 30 days, or any flag. We match the payer’s name and phone to the account and an ID."),
      c("11.3", "", "No third-party payments without the payer’s verified consent. Refunds go only to the original payment source."),
      c("11.4", "", "Suspicious orders are held. We keep records for 6 years and report suspicious activity to the Financial Intelligence Centre (Ghana) and the National Crime Agency (UK) as required."),
      // adjusted: the pack reads "Compliance owner (MLRO): All staff are trained at onboarding." with no name
      c("11.5", "Training.", "All staff are trained at onboarding."),
    ],
  },
  {
    no: 12,
    slug: "unclaimed-parcels",
    title: "Unclaimed and Abandoned Parcels",
    clauses: [
      c("12.1", "", "After two failed delivery attempts we hold the parcel and notify you by SMS, WhatsApp and email."),
      c("12.2", "", "Storage is free for 14 days. From day 15 a fee per day applies and will be communicated to you."),
      c("12.3", "", "At day 60 we send a final notice. At day 90 we may sell or dispose of goods to recover charges, as the law allows, and refund any surplus."),
    ],
  },
];

/** What was changed from the supplied Policy Pack, and why, for the owner to confirm. */
export const NOTES = [
  "2.5: “through Eversend and Paystack” now reads “through our payment partners”, because the website does not use Eversend.",
  "9.11: “MFA for staff and the admin area” now reads “role-based access for staff and the admin area”, because staff sign-in has no multi-factor step yet. “(Policy 15)” is dropped because that policy is internal.",
  "11.5: “Compliance owner (MLRO): All staff are trained at onboarding.” now reads “Training. All staff are trained at onboarding.” because no name was given.",
  "9.1: the “[privacy email]”, “[address]” and registration-number placeholders are filled from the contact details in clause 1.1, and the registration sentences appear only when the numbers are entered in Admin → Pricing.",
  "9.14: the cookie policy is numbered 13 here (the pack calls it 13 in its heading and 14 in its clauses).",
];

export const policyBySlug = (slug: string) => POLICIES.find((p) => p.slug === slug);

/** Policy 9's clause 9.1, which names who is registered where only if the owner has entered the numbers. */
export function privacyIntro(opts: { dpcRegNo: string; icoRegNo: string; email: string }): Clause {
  const regs: string[] = [];
  if (opts.dpcRegNo) regs.push(`the Data Protection Commission (Ghana), registration no. ${opts.dpcRegNo}`);
  if (opts.icoRegNo) regs.push(`the Information Commissioner’s Office (UK), registration no. ${opts.icoRegNo}`);
  return c(
    "9.1", "Who we are.",
    `Atombo Logistics Ltd and Atombo Logistics Limited Company are joint controllers of your personal data. Contact: ${opts.email}, or at ${COMPANY.uk}, and ${COMPANY.gh}. ` +
      (regs.length ? `We are registered with ${regs.join(" and ")}. ` : "") +
      "This policy applies to our website, apps, WhatsApp and phone channels, and delivery services, and follows the Data Protection Act, 2012 (Act 843) and the UK GDPR.",
  );
}
