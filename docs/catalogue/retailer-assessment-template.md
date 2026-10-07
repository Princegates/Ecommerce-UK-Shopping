# Retailer Assessment Template

Complete one assessment per candidate UK retailer **before** adding it to the platform.
The outcome sets the retailer's `integration_mode` (see `db/schema.sql`).

> Terms and programme rules change. Record the date and URL of every source and re-check
> every 6 months. Take legal advice on any "unclear" answer before going live.

## 1. Basics

| Field | Value |
|---|---|
| Retailer name | |
| Website | |
| Category | |
| Assessed by / date | |
| Why customers want it (demand evidence) | |
| Typical basket value (GBP) | |
| Typical item weight / size | |

## 2. Can we legitimately sell and buy from them?

| Question | Answer | Source (URL, date) |
|---|---|---|
| Do terms allow purchases made on behalf of a third party (personal shopper / agent)? | yes / no / unclear | |
| Do terms prohibit resale or commercial purchasing? | | |
| Will they ship to a UK business / warehouse address? | | |
| Quantity limits per customer or per order? | | |
| Do they restrict exports or block forwarding-address use? | | |
| Account required to buy (guest checkout allowed)? | | |
| Payment methods accepted from us (company card, PayPal)? | | |
| Fraud / verification risk for repeat purchases from one account? | | |

## 3. Data availability

| Question | Answer |
|---|---|
| Official API? (URL, access terms, cost) | |
| Affiliate network feed? (Awin / CJ / Rakuten / Impact / other) | |
| Does the programme allow agent/forwarding use, or promotion only? | |
| Feed format (CSV / XML / JSON) and refresh frequency | |
| Fields present: name, brand, SKU, price, stock, variants, images, weight, dimensions | |
| Image / description licence: may we display them? | |
| Direct partnership contact? | |

## 4. Fulfilment and returns

| Question | Answer |
|---|---|
| UK delivery cost and lead time | |
| Free-delivery threshold | |
| Return window / who pays return shipping | |
| Typical order cancellation window | |
| Packaging (can it be consolidated / repacked?) | |

## 5. Shipping / import risk

| Question | Answer |
|---|---|
| Items needing air-freight restrictions (batteries, liquids, aerosols, perfume) | |
| Items restricted or prohibited for import to Ghana | |
| High-theft / high-value categories (phones, laptops) | |
| Expected customs duty band (HS code range) | |

## 6. Score and decision

Score each 0–2 (0 = blocker, 1 = workable, 2 = good).

| Criterion | Score |
|---|---|
| Legal fit (section 2) | |
| Data availability (section 3) | |
| Fulfilment ease (section 4) | |
| Shipping/import risk (section 5) | |
| Customer demand | |
| **Total (max 10)** | |

Any **0 in Legal fit** means do not onboard.

**Decision / integration mode**

| Mode | When to use |
|---|---|
| `OFFICIAL_API` | Official API available and permitted |
| `PRODUCT_FEED` | Feed available and agent use permitted |
| `APPROVED_INTEGRATION` | Written agreement with the retailer |
| `MANUAL_CATALOGUE` | Curated products entered by staff, retailer terms permit purchase |
| `BUY_FOR_ME` | No catalogue; customers supply links |
| `INACTIVE` | Not onboarded / blocked |

**Notes, conditions, follow-ups:**
