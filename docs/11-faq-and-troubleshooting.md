# 11. FAQ and troubleshooting

## For the operator

### Customers say they cannot pay
Check **Admin → Integrations → Readiness**: a payment gateway must be configured **and switched on**. Check the gateway's own dashboard for errors, and that `APP_URL` is your live `https` address with the gateway webhook registered. On the Dashboard look for "Payments with the wrong amount".

### A customer paid but the order still says "Awaiting payment"
The gateway's confirmation has not reached the site (or the amount did not match). Check the order's **Payments** panel, the gateway dashboard, and the webhook delivery log at the gateway. Staff cannot mark an order paid by hand. If the gateway shows the payment as successful, **resend the webhook** from the gateway's dashboard (most have a resend button); the site applies each event once, so resending is safe. If the gateway shows no payment, the customer has not paid.

### How do I refund?
Cancel the order (allowed up to *Buying from the UK shop*), refund the customer **in your gateway's dashboard**, then open the order and click **Mark as: Refunded**. The site does not move money itself.

### An order was cancelled after payment and shows on the dashboard
That is the "Paid orders that need a refund" reminder. Refund and mark it refunded.

### I changed the exchange rate: do old orders change?
No. Each order stores the rate, markup and every amount at the time it was placed.

### Prices on the site look wrong
Prices are the **UK price × effective rate** (rate plus markup) plus service charge, shipping and delivery. Open **Admin → Pricing → What customers pay now** to see a worked example, and check **Shipping** (rate card) and **Delivery areas**. Imported prices come from the source; check the source and its last run.

### A product has no photo
A grey icon shows when an item has no photo or the photo link is dead. Upload a photo in **Items**, or check the feed's image column. Imported images are linked from the source.

### Products disappeared
Imported items are hidden when their source stops refreshing them (the "hide items not refreshed for N days" setting), when they vanish from a complete feed, or when a source was removed with its products. Check **Catalogue sources** → the source → recent runs.

### A catalogue source says "Blocked by the shop"
The shop refuses automated reading (HTTP 403 and similar). The importer will **not** try to get around this. Use an affiliate feed, link orders, or remove the source. See [Catalogue sources](04-catalogue-sources.md).

### The eBay source says to add keys
Enter the App ID and Cert ID in **Integrations → Catalogue APIs**, switch eBay on, and press **Test connection**.

### The Diffbot source reads nothing, or says "the shop's robots.txt does not allow it"
The shop's `robots.txt` disallows that page (or the shop refused even the request for `robots.txt`), so nothing was sent to Diffbot. That is deliberate and is not a Diffbot fault. Use the shop's affiliate feed instead. If instead the run stops with "did not accept the token" or "credits have run out", fix the token under Integrations or add credits at Diffbot.

### The WooCommerce source says "does not look like a WooCommerce shop"
Open `theirshop/wp-json/wc/store/v1/products`. If it is not a block of text starting with `[{"id":`, the shop is not on WooCommerce or has switched its public list off, and it cannot be read. Ask the owner for a product feed instead. If the text shows a currency other than `GBP`, the shop cannot be used.

### The Shopify source says "does not look like a Shopify shop"
Open `theirshop/meta.json`. If it is not a short block of text with `"currency":"GBP"`, the shop is not on Shopify or does not price in pounds.

### A staff member cannot see a page / button
Their account does not have that right. The super admin can change it under **Staff accounts**. Changing it signs them out; they sign in again to get the new access.

### I forgot the super admin password
Set a new `ADMIN_PASSWORD` in the host's settings and redeploy. See [Deployment → runbooks](05-deployment-and-operations.md#58-runbooks).

### A staff member forgot theirs
Super admin → **Staff accounts** → the person → **Reset password**.

### Messages are not being sent
**Admin → Messages** shows each failure and why. Typical causes: missing or wrong provider key, an unapproved SMS sender name or WhatsApp template, the channel not switched on, or the status not ticked under **Which updates are sent**. Press **Retry** after fixing.

### Link request: the customer says the link does not work
The quote may have **expired** (it is held for the number of days you set), or the customer is not signed in as the same person. Open the request, **Change the quote** (this keeps the same link and gives it a new expiry) and send it again.

### The price the system read for a link is wrong
Large shop pages can contain several prices. Switch off **Quote by itself when the price is read from the shop's own web page** under **Link requests → Automatic quotes** so every request waits for your team, and check how many were wrong before turning it back on.

### Which devices and browsers are supported?
Built for current versions of the major browsers on desktop, Android and iPhone, and for phone widths from about 320 pixels. It has been tested in Chrome (desktop and an emulated phone); check Safari on a real iPhone yourself.

## For customers (quick answers)

### Do I need an account?
To **check out**, yes. You can browse and look up an order without one.

### Is my card safe?
You pay on the payment partner's own page. We never see or store your card details.

### Why is there a service charge?
It covers buying, handling and arranging shipment for you. It is shown as its own line.

### Are customs duties included?
No. Any duty or taxes charged by customs in Ghana are not included in the total.

### I pasted a link and it said it could not read the page
Some shops do not allow automatic reading. Choose **Request it anyway**: we check the price and send you a link to pay.

### Can I cancel?
Before we have bought the item (up to *Buying from the UK shop*), yes: contact us. After that it usually cannot be cancelled.

### I forgot my password
Use **Forgot password** on the sign-in page. The link works for 60 minutes.

## Error messages you may see

| Message | Meaning |
| --- | --- |
| "Too many attempts. Try again in 15 minutes." | Sign-in is temporarily blocked after repeated failures. Wait, or ask the super admin to reset the password. |
| "That email and password do not match an active staff account." | Wrong details, or the account is switched off or deleted. |
| "No access" | Your account does not have the right for that page. |
| "The minimum order is £…" | The items total is below the minimum set on **Pricing**. |
| "This quote has expired…" | A link-order price was held for its set days and the time passed. Ask for a fresh one. |
| "Online payment is not set up yet." | No gateway is configured, or `APP_URL` is not an `https` address. |
| "Admin is locked. Set ADMIN_PASSWORD and ADMIN_SECRET…" | Those two settings are missing on the server. |
