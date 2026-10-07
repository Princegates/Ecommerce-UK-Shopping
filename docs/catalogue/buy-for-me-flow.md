# Buy-for-Me Intake Flow

Buy-for-Me (BFM) is the MVP's main route for products outside the curated catalogue.
The customer supplies the UK product link, staff verify it, the platform quotes, and the
customer pays the platform. After payment the order enters the normal purchasing flow.

## Customer steps

1. Customer selects **"Can't find your product?"**.
2. Pastes the UK product URL.
3. Enters what they saw: title, size/colour, quantity, price (all editable).
4. Optional: delivery preference and notes.
5. Receives a request number and a confirmation message.
6. Gets a quote (email/SMS + in-app) when staff finish review.
7. Accepts and pays within the quote validity window.

## Staff steps

1. Open the BFM queue (oldest first).
2. Open the link and confirm: product exists, in stock, size/colour available, real price.
3. Match or create the retailer record. Check its `integration_mode` is not `INACTIVE`.
4. Check restrictions (battery, liquid, prohibited/limited import, retailer quantity limit,
   retailer forbids agent purchases). Tag the request.
5. Enter verified price and estimated weight/dimensions.
6. System prices it with the pricing engine and creates a quote. Staff review and send.
7. Reject with a reason if it is not purchasable or is a restricted item.

## Status model

```
SUBMITTED -> UNDER_REVIEW -> QUOTED -> ACCEPTED
                 |              |
                 v              +-> EXPIRED  (valid_until passed)
             NEEDS_INFO ---------> back to UNDER_REVIEW
                 |
SUBMITTED / UNDER_REVIEW / NEEDS_INFO / QUOTED -> REJECTED | CANCELLED
```

Allowed transitions only; anything else is rejected and logged.

| From | To | By |
|---|---|---|
| SUBMITTED | UNDER_REVIEW | staff (claim) |
| UNDER_REVIEW | NEEDS_INFO | staff |
| NEEDS_INFO | UNDER_REVIEW | customer replies / staff |
| UNDER_REVIEW | QUOTED | staff |
| QUOTED | ACCEPTED | customer, on successful payment |
| QUOTED | EXPIRED | system job |
| any open state | REJECTED | staff, reason required |
| any open state | CANCELLED | customer or staff |

`ACCEPTED` creates a paid customer order, with a `purchases` record for the retailer.

## Pricing and validity

- Quote total uses the same pricing engine as the cart (product, UK delivery, service fee,
  freight estimate by weight bracket, handling, customs estimate, Ghana delivery).
- FX rate, source and markup are stored on the quote.
- `valid_until` covers both the price lock and the FX lock (default 24 h, admin-configurable).
- Expired quotes cannot be paid. The customer can request re-quote.
- Freight is an estimate. Final weight is known only on UK receipt; a balance-due or
  credit step applies if the difference exceeds the configured tolerance.

## Customer-supplied data is untrusted

- Validate and normalise the URL (https only; no internal/private hosts).
- Never fetch the URL server-side on behalf of the customer without an allowlist
  (SSRF risk). MVP: staff open it manually.
- Escape all customer text on display. Limit field lengths and rate-limit submissions.

## MVP vs later

| MVP | Later |
|---|---|
| Staff verify manually | Allowlisted metadata fetch for approved retailers |
| Customer types size/price | Browser extension / bookmarklet that sends product details |
| Email/SMS notices | WhatsApp |
| One quote per request | Re-quote, partial approval, price-change approval |

## Tables

`buy_for_me_requests`, `quotes`, `retailers`, `restriction_tags` — see `db/schema.sql`.
