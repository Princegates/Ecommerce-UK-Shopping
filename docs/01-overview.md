# 1. Overview

## What the system is

A website where a shopper in Ghana can:

- browse shops and products that you list, with every price shown in **pounds and cedis**;
- send a link to **any** UK product, even from a shop you do not list, and get a price;
- check out and pay once, in cedis;
- track the order from the UK shop to their door.

You (the operator) buy the items from the UK retailers, ship them to Ghana, and a third-party courier makes the last delivery. The site does not hold stock.

## The money: how a customer's total is worked out

```
customer total = items + service charge + shipping to Ghana + delivery in Ghana
```

| Part | How it is worked out | Where you set it |
| --- | --- | --- |
| **Items** | UK price in pounds × quantity, converted to cedis at the **effective rate** (your rate plus your markup). | Admin → Pricing (exchange rate and markup) |
| **Service charge** | Your fee for buying on the customer's behalf: a percentage (with a minimum), a flat amount, or tiered bands by item total. Always shown as its own line. | Admin → Pricing |
| **Shipping to Ghana** | From the chosen shipping method's **rate card**, by chargeable weight (the larger of actual and volumetric weight; today items carry their actual weight, so that is what is used). A parcel up to a bracket's weight costs that bracket's price; above the largest bracket there is a charge per extra kilogram; there is a minimum charge. | Admin → Shipping |
| **Delivery in Ghana** | A flat fee for the chosen delivery area. | Admin → Delivery areas |

All money is stored as whole units (pence for pounds, pesewas for cedis), so there are no rounding drifts. The same calculation runs on the product page, the cart, checkout and when the order is saved, so the figure a customer sees is the figure they are charged. The order stores the rate, markup and every amount at the moment it was placed, so later changes to your settings never alter an old order.

**Starting values** for a new database (change them on first day): service charge 10% with a GH₵30 minimum; exchange rate GH₵15.20 per £1 with a 3% markup; minimum order £10 of items; two shipping methods (Air freight, 8 to 12 days; Express air, 4 to 7 days) with sample rate cards; five delivery areas from GH₵30 to GH₵120.

Customs duty and taxes charged in Ghana are **not** included in the total. The shop says so at checkout.

## The life of an order

```
Customer pays ──► Payment received ──► Buying from the UK shop ──► Bought from the UK shop
      ──► Received at our UK address ──► On its way to Ghana ──► Clearing customs in Ghana
      ──► Out for delivery ──► Delivered
```

Rules the system enforces:

- **Only a confirmed payment** (from the payment gateway) moves an order to *Payment received*. Staff cannot mark an order paid by hand.
- Staff move an order **one step forward at a time**. They can **cancel** it up to *Buying from the UK shop*. A cancelled order that was paid can then be marked **Refunded** after you refund the customer through your gateway.
- Staff can add **tracking entries** at four stages: *UK shop dispatch*, *Received at our UK address*, *UK to Ghana shipment* and *Delivery in Ghana* (carrier, reference and a link).
- Each status change can send the customer an SMS, WhatsApp message and/or email, depending on your rules and the customer's choices.
- Customers see the same stages in their account, with the notes you add.

## Where products come from

You decide which UK shops to show and fill them with products from **catalogue sources**: eBay's official API, Shopify shops, product feeds, file imports and pasted links. The importer keeps prices and stock fresh and follows strict rules (it obeys `robots.txt` and stops when a shop refuses). See [Catalogue sources](04-catalogue-sources.md).

Shops that **block** automated reading (many large retailers do) are served by **link orders**: the customer pastes the product link, the system or your team prices it, and the customer pays through normal checkout. See [Admin guide → Link requests](02-admin-guide.md#link-requests).

## Who uses it

| Person | What they do |
| --- | --- |
| **Customer** | Browses, pastes links, orders, pays, tracks, reviews delivered items. Needs an account to check out. |
| **Super admin** | The developer. Signs in with `ADMIN_PASSWORD`. Can do everything and is the only one who can create staff accounts. |
| **Staff** | Signed in with email and password. Each person only has the rights the super admin gave them (for example *Customer support* or *Finance*). |

## Glossary

| Term | Meaning |
| --- | --- |
| **Catalogue source** | One place the importer is allowed to read a shop's products from. |
| **Link order** | An order for an item the customer found elsewhere and sent as a link, priced by a quote. |
| **Quote** | The UK price and weight of one item, entered by your team or filled in automatically, plus a private pay link for the customer. |
| **Effective rate** | The exchange rate customers actually pay: your rate with your markup added. |
| **Rate card** | The shipping price list for one method, by weight. |
| **Chargeable weight** | The larger of the real weight and the volumetric weight, used for shipping. |
| **Super admin** | The developer's sign-in; not stored in the database. |
| **Right (permission)** | One thing a staff account may do, such as "Update orders". |
| **Gateway** | A payment provider: Stripe, Paystack or Flutterwave. |
| **Outbox** | The queue of messages waiting to be sent to customers, with retries. |
| **Held item** | An imported item waiting in Import review because its price looked odd or jumped. |
