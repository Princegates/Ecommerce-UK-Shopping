# 2. Admin guide

For the people who run the shop. Everything is under **/admin**. What you can see depends on your account: the menu only shows pages you are allowed to open.

## Contents

1. [Signing in](#1-signing-in)
2. [Your first day: set-up checklist](#2-your-first-day-set-up-checklist)
3. [The daily routine](#3-the-daily-routine)
4. [Every page, one by one](#4-every-page-one-by-one)
5. [Link orders in detail](#5-link-orders-in-detail)
6. [Using the admin on a phone](#6-using-the-admin-on-a-phone)
7. [Staff accounts and access](#7-staff-accounts-and-access)
8. [Good habits](#8-good-habits)

---

## 1. Signing in

| Who | Where | With |
| --- | --- | --- |
| **Staff** | `/admin/login` | Their email and password. |
| **Super admin** (the developer) | `/admin/login?developer=1` (the "Developer sign-in" link under the form) | The `ADMIN_PASSWORD` set on the server. |

- A new staff member signs in with the first password the super admin gave them and is **asked to choose their own** before anything else opens (minimum 10 characters).
- After **5 wrong attempts** from one place, or 8 for one email, sign-in is blocked for 15 minutes.
- Sessions last 8 hours. **Sign out** is in the sidebar (on a phone, under **Menu**).
- Change your own password any time under **My account**.

## 2. Your first day: set-up checklist

Do these in order before announcing the shop.

1. **Pricing** (Admin → Pricing): set the exchange rate, your markup, the service charge and the minimum order. Set the site name.
2. **Shipping** (Admin → Shipping): replace the sample rate cards with your real prices per weight bracket.
3. **Delivery areas** (Admin → Delivery areas): your real areas and delivery fees.
4. **Integrations** (Admin → Integrations): add **at least one payment gateway**, then message providers (SMS, WhatsApp, email). Use each card's **Test** button. Without a gateway customers cannot pay.
5. **Shops and catalogue sources**: create shops, then add sources so they fill with products ([Catalogue sources](04-catalogue-sources.md)).
6. **Appearance**: pick a colour theme.
7. **Staff accounts** (super admin): create an account for each person with only the access they need.
8. **Place one real small order** with a real payment, and follow it through every status, before telling customers.

## 3. The daily routine

Open the **Dashboard** first. The **Needs attention** list tells you what to do, most urgent first:

| Item | What to do |
| --- | --- |
| Paid orders that need a refund | Orders cancelled after payment. Refund the customer in your gateway's dashboard, then mark the order **Refunded**. |
| Payments with the wrong amount | A gateway reported a different amount than the site asked for. Check before shipping anything. |
| Paid orders waiting to be bought | Buy these from the UK shops, then move each order on. |
| New link requests | Check the price and stock, then send a quote (unless it was quoted automatically). |
| Orders with no movement for 5+ days | Chase the shop, forwarder or courier. |
| Imported items waiting for review | Approve or reject them in **Import review**. |
| Catalogue sources that stopped | A shop refused access or a feed failed. Open the source to see why. |
| Messages that could not be sent | Check the provider keys, then retry. |
| Unpaid orders older than 24 hours | A nudge may help. |
| Exchange rate gap | Shown when your rate differs from the market by the alert percentage. |

**Typical order, start to finish**

1. A paid order appears as **Payment received**. Open it, buy the items from the UK shop, and click **Mark as: Buying from the UK shop**, then **Bought from the UK shop**. Put the UK order reference in the note (the customer sees notes).
2. When the parcel reaches your UK address, add a **tracking entry** (*Received at our UK address*) and move the status on.
3. When it ships, add the *UK to Ghana shipment* tracking and mark **On its way to Ghana**; then **Clearing customs**, **Out for delivery** (with the courier's reference under *Delivery in Ghana*), and **Delivered**.
4. Open **What it cost us** on the order and enter the real costs, so the margin is right.

## 4. Every page, one by one

### Dashboard
Key figures for the last 7, 30 or 90 days (revenue, orders, average order, service charge earned, new customers, each compared with the period before), a sales chart, **Orders in progress** by status, **Where the money comes from** (items, service charge, shipping, delivery), **Margin** (from the costs you enter), top shops and items, delivery areas, the exchange rate, customers, integrations status, latest orders and recent admin activity. **Export orders (CSV)** appears if you have that right.

### Orders
Search by order number, name or phone and filter by status. Open an order to see items, delivery details, the price breakdown, the payment attempts, and the full event history.
- **Status buttons** show only the legal next steps. A note is optional; **the customer sees it**.
- **Tracking**: add or remove entries for the four stages (carrier, reference, link, note).
- **What it cost us**: shop price paid (£), UK delivery (£), the rate you bought at, freight, Ghana delivery, payment fees and other costs. The page then shows the **margin**. Needs the *Record costs and see margins* right.
- A **yellow banner** marks a **link order** and says how the price was found (see [section 5](#5-link-orders-in-detail)).

### Customers
Search and open a customer: their orders, saved addresses and details, and two tools: **Help with sign-in** (create a one-time password-reset link to send them yourself) and **Account status** (disable or enable the account; disabling signs the customer out everywhere and does not affect their orders).

### Link requests
Everything customers send by link. See [section 5](#5-link-orders-in-detail).

### Shops
Add, edit and **delete** shops: name, category (this is the **department** shown on the site), tagline, description, website, colour, order on the page, a **logo** (upload a JPEG, PNG, WebP or GIF up to 4 MB, or paste a link) and whether the shop is shown. Deleting a shop removes its items, its sources and their cart/wishlist entries; **orders already placed keep their own record**. You must tick a confirmation. If you only want to hide a shop, untick "Show this shop to customers".

### Items
All products. Add an item by hand (name, brand, category, description, UK price, was-price and deal end, weight, size/colour options, source link, photo upload or link, shown or hidden) or edit existing ones. **Add by link** reads a pasted product link. Imported items appear here too; changes you make by hand to imported items can be overwritten by the next source refresh.

### Catalogue sources
Where products come from. Create, check ("Check this setup first" shows what would be read without saving), run now, switch on or off, upload files for file-import sources, and **remove** a source (keeping or removing the products it brought in). Full details in [Catalogue sources](04-catalogue-sources.md).

### Import review
Items waiting for a person: odd prices (under 50p, over £10,000), price jumps over the source's limit (default 40%), updates you chose to approve by hand. **Approve** puts the item or its new price live; **Reject** keeps it off. There is a bulk approve.

### Reviews
Customer reviews, filterable by **All / Published / Hidden**. Only customers whose order was **delivered** can review that item, once. Hide a review to remove it from the product page.

### Pricing
- **Service charge**: percentage with a minimum, a flat amount, or tiered bands ("up to £50 pay 15%…"). Only the chosen method is used.
- **Exchange rate and minimum order**: GH₵ per £1, the markup, and the smallest order (items only, in £).
- **Site**: site name, the support WhatsApp number, a **contact email** and the **registered business name**. The email and business name appear in the public [privacy policy](#legal-pages-privacy-terms-and-data-deletion) and terms, so fill them in before you submit the policy links to Facebook, Google or Apple.
- **What customers pay now**: a live example so you can see the effect of a change before saving.
- The **exchange-rate feed** policy (manual, suggest or automatic, with a maximum automatic move and an alert gap) is under Integrations.

### Shipping
Shipping methods and their **rate cards**: weight brackets with a price each, a charge per extra kilogram above the biggest bracket, and a minimum charge. Add a method, edit one, or hide one.

### Delivery areas
The areas customers choose at checkout, each with a name, the places included, the Ghana delivery fee, the usual delivery time, order and whether it is offered. You can add, edit and **delete** areas. You cannot delete the **last active** area (checkout needs somewhere to deliver). Orders already placed keep the area name and fee they were charged.

### Appearance
Choose one of **15 colour themes**. It applies to the whole shop at once.

### Integrations
Keys for every outside service, stored **encrypted** and shown only masked. An environment setting on the server always wins over a saved one. Sections: **Readiness** (what is missing), **Payment gateways**, **Messaging channels**, **Catalogue APIs** (eBay), **Exchange rate feed**, and **Which updates are sent** (per order status, which channels are used). Each card shows the webhook address to register and a **Test** button. Details in [Integrations](09-integrations.md).

### Messages
The log of every SMS, WhatsApp message and email sent to customers (recipients are partly hidden), with status. Failed messages are tried three times, then wait for you: **Retry** one or **Send queued messages now**.

### Activity log
Who did what and when: sign-ins, settings changes, order status changes, staff changes, exports. Search it. Staff actions show the person's name and email; automatic actions show "system".

### Staff accounts (super admin only)
See [section 7](#7-staff-accounts-and-access).

### My account
Your name, role and rights, and **Change password**.

## 5. Link orders in detail

A **link order** is an order for an item that is **not in your catalogue**. It exists because many big retailers block automated reading, so you cannot list their products, but you can still buy from them for customers.

### How the customer starts
They paste a product link into the big box on the home page, the header's **Add by link** button, the search bar, or the **Paste link** tab on a phone (or open `/request`). If the system can read the page, they see the name and the price in pounds and cedis and can continue in one step.

### What the system does
For each request the system saves the link, the quantity, the size/colour notes, the **kind of item**, and who sent it. Then:

- If it **can read the price from the shop's own page**, and that is allowed by your rules, it **quotes by itself** and the customer can pay immediately.
- If it cannot, and **customer-typed prices** are allowed, it quotes from the price the customer typed **plus your safety margin**.
- Otherwise the request waits in **Link requests** for your team.

### Your team's part (**Admin → Link requests**)
1. Open the link on the shop and check the real price and stock.
2. Enter the **UK price of one item** and its **weight** (grams). Choose how many **days** to hold the price and add an optional **note** for the customer.
3. Click **Send quote**. The customer is messaged a **private pay link** (email first, then SMS). The link is also shown on the page so you can send it yourself, for example on WhatsApp. **Change the quote** any time before the customer orders; the link keeps working.

### Automatic quotes (settings at the top of Link requests)
| Setting | What it does |
| --- | --- |
| Quote by itself when the price is read from the shop's own web page | On by default. The safe automatic option. |
| Also quote by itself from the price the customer typed | Off by default. The system cannot check this price. |
| Safety margin on customer-typed prices | Percentage added on top of the typed price (default 5%). |
| Automatic limit | Above this UK price for one item (default £150) a person must quote. |
| Hold each price for | Days a quote stays valid (default 3). |
| Item types and weights | The list customers choose from, with a default weight each, used to work out shipping. Keep a catch-all such as "Other or not sure" last. |

### What the customer does
They open their private link (or **See price and pay** in their account), sign in if needed, see the **full cost in cedis**, choose delivery and shipping, and pay through the normal checkout. The quote expires after the days you set; an expired link asks them to contact you.

### Confirming a payment by hand
If money has really arrived but the order still says **Awaiting payment** (no gateway is set up yet, a gateway message was missed, or the customer paid by bank transfer), open the order and use **Confirm payment by hand**. It needs the *Confirm a payment by hand* right, which only the super admin and **Manager** have unless you give it to someone.
- Pick how it was paid, enter the **reference** (bank, Mobile Money or gateway transaction ID) and **why** you are doing it, and tick that you have seen the money arrive.
- The order becomes **Payment received** and the customer is messaged, exactly as with a gateway payment. Customers see only "Payment received"; the reference and reason are kept in the **Payments** box on the order and the **Activity log**, with your name.
- It works only on an order still awaiting payment, only once, and the same reference cannot release two orders. Any waiting gateway attempt on the order is retired.
- It cannot be undone from this page. If you confirmed the wrong order, cancel it and refund as usual.

### After payment
It is an **ordinary order**: same statuses, tracking, messages, refunds and costs. A **yellow banner** on the order tells you how the price was found:
- *read from the shop's page by the system*,
- *typed by the customer plus a margin, so it is not verified*, or
- *quoted by the team*.

**Always check the shop's price again before you buy.** If it is now higher, contact the customer first; you can cancel and refund from the order page.

### Amazon UK requests
Amazon does not allow shops to read its pages, so the system never opens an Amazon link. Instead:
- The search page offers customers a link to Amazon UK's own search; they pick the item there and send it back by pasting the link, by the phone's **Share** menu or by the bookmarklet on the **Order from Amazon UK** page (`/amazon`).
- The link is cleaned to `amazon.co.uk/dp/<ASIN>`. Amazon.com and other Amazon stores are refused with a message pointing to the UK link.
- The name and price in the request come from **the customer** (or their bookmarklet), not from Amazon. They are only a guide. Always open the link, confirm the real price, size/colour and stock, and quote it yourself, or let the customer-typed-price automatic quote apply if you have switched it on (it adds your safety margin).

### Requests with no link
A customer can describe an item in words instead of pasting a link. Those requests show a **No link** tag with **Search Amazon UK** and **Search Google UK** buttons that search for the customer's words. Find the exact item, paste its link into **Link to the item you found** (Amazon UK links are tidied; other Amazon stores are ignored), enter the UK price and weight and send the quote. They are never priced automatically. Always check size, colour and stock before quoting.

### Limits to be aware of
- Amazon-style pages can show several prices (other sellers, other sizes). A single read may pick the wrong one. Check a few real items before relying on automatic quotes for a shop.
- Item-type weights are estimates; a heavy or bulky item may cost more to ship than the rate card suggests.

## 6. Using the admin on a phone
On a phone the sidebar becomes a top bar with a **Menu** button. The menu lists every page you can open, plus **View the site**, **Signed in as…** and **Sign out**, and closes when you choose a page. Orders, customers and items appear as cards with labelled fields instead of wide tables. Long forms scroll down; nothing needs sideways scrolling.

## 7. Staff accounts and access

Only the **super admin** sees **Staff accounts**. Staff cannot create or change accounts and cannot give themselves more access; that right can never be granted.

### Creating an account
**Admin → Staff accounts → + Add a staff account**: name, email (their sign-in), a **first password** (use **Suggest one**; give it to them yourself), and a **role**. They must choose their own password at first sign-in.

### Roles
Picking a role ticks its rights. Changing any tick switches the role to **Custom**. Granting a *change* right always grants the matching *view* right.

| Right | What it allows | Manager | Operations | Customer support | Catalogue editor | Finance | Read-only |
| --- | --- | :---: | :---: | :---: | :---: | :---: | :---: |
| See the dashboard (dashboard.view) | Sales, revenue and customer figures. | ✔ | ✔ |  |  | ✔ | ✔ |
| See orders (orders.view) | Order list and details, including customer names, phones and addresses. | ✔ | ✔ | ✔ |  | ✔ | ✔ |
| Update orders (orders.manage) | Change order status, add tracking, cancel and refund. | ✔ | ✔ |  |  |  |  |
| Record costs and see margins (orders.costs) | What the team paid to buy and ship items, and the profit on each order. | ✔ |  |  |  | ✔ |  |
| Download the orders file (orders.export) | Export orders with customer details as a spreadsheet. | ✔ | ✔ |  |  | ✔ |  |
| See customers (customers.view) | Customer accounts, contact details and order history. | ✔ | ✔ | ✔ |  |  | ✔ |
| Manage customers (customers.manage) | Disable or enable accounts and create password-reset links. | ✔ |  |  |  |  |  |
| Handle link requests (requests.manage) | Quote link requests, and set the automatic-quote rules. | ✔ | ✔ | ✔ |  |  |  |
| Manage shops (shops.manage) | Add, edit and delete shops and their logos. | ✔ |  |  | ✔ |  |  |
| Manage items (items.manage) | Add, edit and hide items, photos and deals. | ✔ |  |  | ✔ |  |  |
| Manage catalogue sources (sources.manage) | Feeds, Shopify, WooCommerce, eBay, Diffbot and file imports. | ✔ |  |  | ✔ |  |  |
| Review imported items (import.review) | Approve or reject items waiting in Import review. | ✔ |  |  | ✔ |  |  |
| Moderate reviews (reviews.manage) | Publish or hide customer reviews. | ✔ |  |  | ✔ |  |  |
| Change prices and delivery (pricing.manage) | Service charge, exchange rate, shipping rates and delivery areas. | ✔ |  |  |  |  |  |
| Change the look of the site (appearance.manage) | Colour themes. | ✔ |  |  |  |  |  |
| Confirm a payment by hand (orders.confirm_payment) | Mark an unpaid order as paid when the money arrived outside the payment flow. Sensitive: it starts the buying. | ✔ |  |  |  |  |  |
| Manage integrations and keys (integrations.manage) | Payment, SMS, email and other service keys. Very sensitive. | ✔ |  |  |  |  |  |
| See messages sent (messages.view) | The log of messages sent to customers. | ✔ | ✔ | ✔ |  |  |  |
| Manage messages (messages.manage) | Retry failed messages and choose which updates are sent. | ✔ |  |  |  |  |  |
| See the activity log (audit.view) | Who changed what, and when. | ✔ |  |  |  | ✔ |  |

### Legal pages: privacy, terms and data deletion
The shop has three public pages, linked from the footer: **`/privacy`** (privacy policy), **`/terms`** (terms of service) and **`/data-deletion`** (how to delete an account and what is kept). Facebook, Google and Apple ask for these addresses, for example `https://your-domain/privacy`. Facebook's "data deletion instructions URL" is `/data-deletion`.
- They take your business name and contact details from **Pricing → Site**, so nothing about the business is written into the text.
- The wording describes what the shop does today (what it collects, who it shares with, how deletion works). **It is a starting draft, not legal advice.** Have a lawyer in your market read it before you rely on it, check the governing law (it says Ghana), the refund wording, and whether you must register with the Data Protection Commission.
- If you change what the shop collects or who it shares data with, change the wording in `src/app/(site)/privacy/page.tsx` and update the date in `src/components/LegalPage.tsx`.

### Managing an account
Open it from the list to: **change name, role and rights** (this signs them out so the new rights apply at once), **switch off or on** (switching off signs them out everywhere immediately), **reset the password** (they must choose a new one; they are signed out), or **delete** (confirmation needed; their past actions stay in the activity log under their name).

### What staff see
The menu shows only the pages they may open. Typing the address of another page shows **No access**. On an order, staff who can view but not update see "You can look at this order but not change it", with no status or tracking buttons; costs and margins are hidden unless they have that right; the orders download needs its own right.

### Choosing roles well
- **Customer support** and **Operations** are safe for most people.
- **Manager** includes **integration keys** and **prices**. Give it to very few people.
- Anyone who handles payments needs **Finance** or **Operations**, not **Read-only**.

## 8. Good habits

- Give each person their **own** account. Never share the super admin password.
- Switch off the account of anyone who leaves **the same day**.
- Check the **Activity log** weekly.
- Keep **backups** (see [Deployment and operations](05-deployment-and-operations.md)).
- Before you buy a link order, **check the price again**.
- Treat imported prices as a guide: read the price on the shop before buying.
