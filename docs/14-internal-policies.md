# 14. Internal policies

These three policies are part of the business's Policy Pack (effective 1 November 2026) but are **internal**: they are for staff and partners, not customers, so the website does not publish them. The customer-facing policies (1 to 13) are on the website under **All policies** in the footer.

Items still to be filled in by the business are marked **[to complete]**.

## 15. Information Security Policy (internal)

15.1 **Purpose and owner.** Protect customer data, money movement and the pricing engine. Aligned to ISO/IEC 27001 and the NIST Cybersecurity Framework, and to Ghana's Data Protection Act (Act 843), Cybersecurity Act (Act 1038) and the UK GDPR. Security lead: Matthew Sackey. Reviewed every 12 months and after any major incident.

15.2 **Risk management.** Keep an asset inventory and a risk register (owner, likelihood, impact, treatment). Review the register quarterly. Accept a risk only in writing, with a review date.

15.3 **Access control.** Least privilege and unique accounts. MFA on email, hosting, code repositories, payment, FX and admin tools. Joiner, mover and leaver changes within 24 hours. Quarterly access review. The admin area is not linked from the public site and is reachable only through SSO or an IP allow-list.

15.4 **Data classes.** Public; Internal; Confidential (customer contact data, supplier rates, margins, pricing config); Restricted (ID numbers, customs documents, bank details, API keys). Restricted data is encrypted, access-logged and never sent over WhatsApp or personal email.

15.5 **Secure development.** Code review for every change; dependency and secret scanning; OWASP Top 10 testing before release; independent penetration test yearly. Secrets live in a vault, never in code. Pricing logic, cost data and margins run on the server only and are never returned to the browser. Rate-limit quote and login endpoints.

15.6 **Infrastructure.** TLS 1.2 or higher, encryption at rest, web application firewall, hardened cloud configuration. Daily backups, restore tested quarterly, logs kept 12 months.

15.7 **Payments and FX.** Use hosted checkout so card data never touches our systems (PCI DSS SAQ A). Verify webhook signatures. Reconcile collections and payouts daily. Two people approve any payout above £10,000 and any change to a beneficiary bank account.

15.8 **Devices and email.** Disk encryption, screen lock, patching (critical within 72 hours, others within 14 days), SPF, DKIM and DMARC. Report phishing at once.

15.9 **Suppliers.** Security checks and data-protection terms before onboarding (Policy 16).

15.10 **Incidents.** Report to the security lead immediately. Classify severity; contain, preserve evidence, fix, review. Notify the ICO within 72 hours, and the Data Protection Commission (Ghana) and Cyber Security Authority as the law requires. Tell affected customers without undue delay.

15.11 **Continuity.** Target recovery within 24 hours with at most 24 hours of data loss. A manual order and payment-reconciliation fallback exists for outages.

15.12 **Fraud and account takeover.** Velocity limits, device checks, one-time codes for delivery handover, and review of address or phone changes close to dispatch.

15.13 **Training and checks.** Security training at onboarding and yearly; phishing tests twice a year; quarterly self-audit against this policy. Targets: MFA on 100% of accounts, patch deadlines met, zero public admin links.

15.14 **Exceptions.** Only with written approval from the security lead and a review date.

## 16. Partner Management Policy (internal)

16.1 **Scope.** Freight forwarders and airlines, customs agents, last-mile couriers, insurers and brokers, payment and FX providers, retailers and marketplaces, and IT suppliers.

16.2 **Tiers.** Tier 1 (critical): forwarder, customs agent, payment and FX provider, insurer. Tier 2: couriers, key retailers. Tier 3: everyone else. Tier 1 partners get the full checks below and a quarterly review.

16.3 **Onboarding checks.** Company registration; licences (GRA customs agent licence, NIC licence for insurers, Bank of Ghana or FCA authorisation for payment firms); TIN and VAT status; goods-in-transit liability insurance of at least **[amount: to complete]**; two references; sanctions and AML screening; financial standing; security and data-protection questionnaire; conflict-of-interest declaration.

16.4 **Contract essentials.** Scope and service levels; rates with 30 days' notice of change; liability, indemnity and insurance; data-protection terms; audit rights; confidentiality; consent for subcontracting; anti-bribery and honest-declaration clauses; termination and exit support.

16.5 **Service levels.**

| Partner | Measure | Target |
| --- | --- | --- |
| UK hub / forwarder | Parcel logged after arrival | Within 24 hours |
| UK hub / forwarder | Manifest and airway bill sent after cut-off | Within 4 hours |
| Customs agent | Clearance after landing | Within 72 hours |
| Courier | Delivery after release | Within 48 hours |
| Courier | First-attempt delivery | 90% or better |
| All handlers | Damage rate | Under 0.5% of parcels |
| Insurer / broker | Claim acknowledgement | Within 2 working days |

16.6 **How we work together.** One order ID follows every parcel. Partners receive a shared manifest (file or API) keyed to that ID and return status events the platform turns into customer updates. Chat groups are for exceptions only, never for instructions that change money, valuation or declarations. Escalation: partner contact, then operations lead, then director, each within 4 working hours.

16.7 **Performance review.** Monthly scorecard against the table above; quarterly review for Tier 1. Two consecutive misses trigger a written improvement plan; a third triggers formal notice.

16.8 **Money and controls.** Invoices are matched to airway bills and manifests before payment. Two people approve payments above £5000 and any change to a partner's bank details, confirmed by call-back to a known number. Riders do not collect cash from customers.

16.9 **Conduct.** No under-declaration, mislabelling or splitting of consignments. No facilitation payments to officials. Any request for one is reported to the director the same day. A proven breach means immediate suspension.

16.10 **Concentration risk.** Within six months have a second qualified partner for each Tier 1 function, with a tested switch-over plan.

16.11 **Offboarding.** Revoke access within 24 hours, recover or delete data, settle open claims, record lessons learned.

16.12 **Required terms for any shipping partner.** The contract must: (a) cover air as well as sea, with air transit times; (b) accept in writing electronics with built-in batteries and high-value goods such as watches and jewellery; (c) state that the partner clears the goods, pays duty and taxes and invoices us at cost with the Ghana Revenue Authority assessments, and name the importer of record; (d) confirm Ghana-licensed marine cargo cover (Policy 6) with certificate details; (e) commit to investigating claims within 7 working days so our 15-working-day promise holds; (f) require proof of delivery (code, photo, time); (g) bar the partner from soliciting or marketing to our customers and limit use of customer data to the shipment; and (h) require our order ID on every parcel label.

## 17. Staff Code of Conduct

17.1 **Who it covers.** Employees, contractors, agents and anyone working for YenkoExpress, including partner staff handling our parcels. Everyone confirms in writing at onboarding and every year.

17.2 **Our principles.** Be honest, follow the law, treat people with respect, protect customers' data and money, and put the customer's interest ahead of a quick sale.

17.3 **Customs and the law.** Never under-declare value, mislabel goods or split consignments, whoever asks. Never offer, give, ask for or accept a bribe or facilitation payment, in Ghana, the UK or anywhere (UK Bribery Act 2010 and Ghana law). Refuse and report any instruction that breaks this.

17.4 **Customers.** Make only claims we can prove. Do not pressure or mislead. Handle complaints fairly and on time. Take extra care with customers who are vulnerable or confused about price.

17.5 **Confidential information.** Pricing rules, supplier rates, margins, cost data and customer lists are confidential. Share them only on a need-to-know basis. Do not post screenshots of the pricing engine or admin area, and do not paste customer data or pricing files into public AI tools.

17.6 **Conflicts of interest.** Declare any personal interest in a partner, supplier or customer. No side deals. No staff discounts or special treatment without written approval.

17.7 **Goods and money.** Open customer parcels only under the documented inspection process, with two people present and recorded. Never use customers' goods. Do not take cash. Refunds go only to the original payment method, with two approvals above GHS 1,000.

17.8 **Speak up.** Report concerns about fraud, safety, unlawful conduct or breaches of this Code to Matthew Sackey, matthew.s@atombologistics.com, or to the director if the concern involves the first contact. Reports are handled confidentially and no one is penalised for a good-faith report. Where it applies, this follows the UK Public Interest Disclosure Act 1998 and Ghana's Whistleblower Act, 2006 (Act 720).

17.9 **Respect and safety.** No harassment, bullying or discrimination. Keep warehouse, rider and delivery work safe. Report injuries and near misses the same day.

17.10 **Public communication.** Only authorised people speak for the company. Do not discuss prices, margins, partners or competitors on social media, and do not make false claims about competitors.

17.11 **Breaches.** Breaches lead to disciplinary action up to dismissal, termination of contracts and, where the law requires, a report to the authorities.

## Where the software does and does not yet match

Some of these policies describe things the software does today and some it does not. Check them against this list.

| Policy says | The software today |
| --- | --- |
| 15.3 The admin area is not linked from the public site | Done. There is no public link to it. |
| 15.3 Admin reachable only through SSO or an IP allow-list; MFA on admin tools | Not built. Staff sign in with a password. Put the admin address behind your host's access controls, or ask for staff two-step sign-in to be built. |
| 15.5 Pricing logic, costs and margins never returned to the browser | Done. The browser receives three customer amounts only. |
| 15.5 Rate-limit quote and login endpoints | Done for sign-in and ordering. |
| 15.7 Verify webhook signatures | Done for all payment gateways. |
| 15.12 One-time codes for delivery handover; review of address or phone changes near dispatch | Not built. |
| 16.8 / 17.7 Two approvals for payouts and for refunds above GHS 1,000 | Not enforced by the software. |
