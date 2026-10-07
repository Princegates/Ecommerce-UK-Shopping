# 9. Integrations

Every outside service the shop talks to, how to set it up, and what the system does with it. Keys are entered in **Admin → Integrations** (needs the *Manage integrations and keys* right) or as environment variables (an environment value always wins). Saved keys are **encrypted** and shown only **masked**.

Each provider card shows: its readiness, the fields to fill in, the **webhook address** to register (for payment gateways), step-by-step instructions, a link to the provider's own documentation, a **switch** and a **Test** button.

The **Readiness** section at the top lists what is still missing, for example "no payment gateway configured".

## How the page works

- **Payment gateways:** you can switch on more than one. Customers choose between those that are on and fully configured.
- **Messaging channels** (SMS, WhatsApp, email): for each channel, **choose which provider is used** (where two are available) and switch it on. A channel only sends if its chosen provider is on and complete.
- **Catalogue APIs:** eBay.
- **Exchange rate feed:** choose a provider and a policy (below).
- **Which updates are sent:** for each order status, tick the channels used. A customer's own choices at checkout apply as well (a customer who turned off SMS gets none).

## Payments

Customers cannot pay until at least one gateway is on. Card data never reaches this server.

| Gateway | Customer pays in | Good for | Webhook address |
| --- | --- | --- | --- |
| **Paystack** | Cedis (GHS) | Ghana cards and Mobile Money (MTN, Telecel, AirtelTigo) | `{APP_URL}/api/webhooks/paystack` |
| **Flutterwave** | Cedis (GHS) | Mobile Money, cards and bank payment | `{APP_URL}/api/webhooks/flutterwave` |
| **Stripe** | GBP by default, or GHS if your Stripe account can charge cedis (setting "Charge customers in") | International and UK cards | `{APP_URL}/api/webhooks/stripe` |

Fields:
- **Stripe:** secret key, **webhook signing secret**; webhook events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
- **Paystack:** secret key.
- **Flutterwave:** secret key and a **secret hash** (a long random value you invent, entered here and in the Flutterwave dashboard's webhook settings).

How payments are confirmed (so you know what to expect):
1. The customer is sent to the gateway's hosted page. The site records the attempt.
2. When the gateway reports success (by **webhook** and/or when the customer returns to the site), the site checks the **signature**, re-asks the gateway where needed, and compares **amount and currency** with the order.
3. Only if they match is the order marked **Payment received**. A repeated event is ignored. A mismatch appears on the dashboard under "Payments with the wrong amount" and the order is **not** marked paid.

Use the demo payment page only for testing (`ALLOW_DEMO_PAYMENTS`); never in production.

## Messages: SMS, WhatsApp, email

Messages go through an **outbox**: an event (payment received, status change, a quote link) queues messages; they are sent right away and **retried up to three times** if the provider fails. After three failures a message waits in **Messages** for you to retry.

| Channel | Providers | What you need |
| --- | --- | --- |
| **SMS** | **Arkesel** (Ghana, branded sender name), **Twilio** | Arkesel: API key and a **registered, approved sender name** (up to 11 letters/numbers). Twilio: account SID, auth token, sender number or Messaging Service. |
| **WhatsApp** | **Meta WhatsApp Cloud API**, **Twilio** | An approved **utility message template** with three variables (1 customer name, 2 order number, 3 the update), because customers may not have messaged you in the last 24 hours. Meta: permanent access token, phone number ID, template name and language. Twilio: WhatsApp sender, optional template SID. |
| **Email** | **Resend**, **Postmark** | A verified sending domain or sender address and the provider's key. |

Defaults for **which updates go on which channel** (editable under *Which updates are sent*):
- Payment received, Received at our UK address, On its way to Ghana, Out for delivery, Delivered, Cancelled, Refunded: **SMS, WhatsApp and email**.
- Buying, Bought, Clearing customs: **email only**.
- Awaiting payment: **none**.

Other messages: **password reset** links (email first, then SMS) and **link-order quotes** (email first, then SMS).

Phone numbers are normalised to international format (Ghana numbers starting `0` become `+233…`).

## Exchange rate feed (optional)

Your own rate (set on **Pricing**) always decides prices. A feed can only suggest or apply a change **inside limits you set**.

| Provider | Key |
| --- | --- |
| **ExchangeRate-API** | API key (the key is part of the request address, so it is never logged) |
| **Open Exchange Rates** | App ID (sent in a header) |

Policy (Integrations → Exchange rate feed):
- **Manual**: the feed is ignored.
- **Suggest** (default): the Dashboard and Integrations show the market rate and the gap; you apply it yourself. The dashboard warns when the gap passes the **alert** percentage (default 3%).
- **Automatic**: the rate moves to the market rate **only if the move is within the limit** (default 5%); bigger moves wait for you. Your **markup** always applies on top.

Every change is recorded in the rate history and the activity log. To update on a schedule, call `GET /api/cron/fx` hourly or daily with the cron secret.

## eBay (catalogue API)

Needs free keys from developer.ebay.com: **App ID** and **Cert ID**, and an **environment** (Production for real listings, Sandbox for test data). Press **Test connection**. Then create a **Catalogue source** of type eBay with your searches. eBay's API licence sets how listing data and photos may be shown and requires a link back to the listing. Read it and check your product pages meet it.

## Webhooks and scheduled jobs: addresses

| What | Address | Protected by |
| --- | --- | --- |
| Stripe / Paystack / Flutterwave webhooks | `POST {APP_URL}/api/webhooks/stripe`, `/paystack`, `/flutterwave` | The gateway's signature |
| Retry queued messages | `GET {APP_URL}/api/cron/messages` | `Authorization: Bearer $CRON_SECRET` |
| Sync the market exchange rate | `GET {APP_URL}/api/cron/fx` | same |
| Run due catalogue sources | `GET {APP_URL}/api/cron/ingest` (only needed if `INGEST_AUTORUN=false`) | same |
| Health check | `GET {APP_URL}/api/health` | none (returns only `{"ok":true}` or 503) |

## Adding a new provider (for developers)
Providers are described in `src/lib/integrations.ts` (fields, environment names, steps, webhook). A payment gateway is an adapter in `src/lib/payments/` implementing `PaymentGateway` (`createCheckout`, `check`, `parseWebhook`); message senders are in `src/lib/notify/senders.ts` and chosen in `deliver()` in `outbox.ts`. Add tests alongside (see `payments.test.ts`, `outbox.test.ts`).
