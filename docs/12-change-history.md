# 12. Change history

What was built and in what order. Every change below is a commit on the `claude/pensive-meitner-d8kx3v` branch; run `git log` for the exact commits. All work so far happened on one day, 7 October 2026, in a series of steps agreed with the owner.

## Foundations

| Step | What was added |
| --- | --- |
| **Platform** | The storefront, customer accounts, order flow with tracking, payments (Stripe, Paystack, Flutterwave), messages (SMS, WhatsApp, email), and the admin console with dashboard, orders, customers, shops, items, pricing, shipping, delivery areas, integrations, messages and activity log. Exchange rate set by the admin, with an optional market feed. |
| **Marketplace storefront** | Marketplace-style layout (deals, departments, shelves, search with suggestions, filters, recently viewed, wishlist), reviews with moderation. |
| **Catalogue importer** | Catalogue sources that fill the shop from feeds and pages, with strict safety rules (robots.txt, polite pacing, stop on refusal, no private addresses), review queue and scheduler. |
| **Look and themes** | A distinct Ghana green and gold look with its own fonts and shapes, marquee and animations, and 15 colour themes chosen in the admin. |
| **Rename and deployment** | Renamed to **SHOP UK FROM GH**. Deployment package: Docker image, Compose with HTTPS, Fly.io and Render configurations, health check, backups guidance. |

## Deployment fixes
- Fixed the Docker build (missing `public` folder) and Render disk permissions (the container now fixes ownership of the data folder, then drops root).
- Render region set to **Frankfurt**.
- Admin link added to the public footer, plus `robots.txt`.

## Products and photos
- Product photo upload and a visible **Add by link** button.
- Category pictures for items without photos; full-size merchant photos preferred in feeds; a "get real products" guide on the Catalogue sources page.
- Fictitious shops removed. A new database now contains only **eBay UK**.

## Catalogue sources
- **eBay** official-API source.
- **Remove source** (keep or remove its products).
- **Shopify** shop source with sizes and colours.
- **Catalogue reader page removed** (`/bot` and its footer link) at the owner's request; the importer's user agent now carries the site's address instead.
- **Privacy policy, terms of service and data-deletion pages**, linked from the footer, with contact email and business name set in Pricing → Site; accounts made with a provider can be deleted without a password.
- **Sign in with Google, Facebook and Apple** for customers, with safe account matching, a phone-number step, and connecting providers from Account → Security.
- **Diffbot** (Product API) source: reads product pages you list, checking `robots.txt` first; paid per product read.
- **WooCommerce** shop source (public Store API product list) with sizes and colours.
- **File import** (CSV or JSON you upload).
- Page titles tidied (shop's own tail removed).

## Shops and delivery
- **Delete a shop** (with confirmation; orders keep their record) and **shop logos** (upload or link; shown on the shop list, shop page, product page and cart).
- **Delete delivery areas** (the last active one is protected).
- Fixed a fault where every shop form used the same field ids.
- Fixed a restart fault: starter data is no longer re-created if every shop has been deleted.
- **Department icons**: 40 line icons chosen from the department's name.

## Link orders
- Pasting a link became the main way to shop: a large box on the home page, header button, search box that recognises links, a **Paste link** tab on phones.
- **Link orders**: link requests are captured, quoted by staff, paid through normal checkout and become ordinary orders.
- **Automatic quotes**: from the shop page's own price, optionally from the customer's typed price plus a margin, with an automatic limit and item-type weights. Link orders show how the price was found.
- **One-click** from a found link to the customer's price and payment.
- Fixed header pop-up panels closing on Safari-style browsers; fixed a rounding error in the safety margin.

## Ordering from Amazon UK
- Amazon UK links are recognised by their ASIN (including short links and shared text) and cleaned; other Amazon stores are refused with a pointer to the UK link. The shop never requests an Amazon page.
- A hand-off link from the search page to Amazon UK's search, an **Order from Amazon UK** page with a one-click bookmarklet, and an installable phone app with a Share-menu entry so a customer can send an Amazon item straight into a request.
- **Request any item**: a customer can describe what they want with no link; staff get Amazon UK / Google UK searches, attach the link they find and quote.
- Customer-typed price stays a guide; staff verify before buying. No Amazon data feed or paid service is used.

## Staff and access
- **Roles and access control**: the developer's password is the **super admin**; staff accounts are created by the super admin with roles or exact rights, forced first-time password change, switch-off with immediate sign-out, and an activity log that names the person. Every admin page and action checks a right, and a test enforces this.

## Phones
- **Admin on a phone**: Menu button, no sideways scrolling, lists as cards.
- **Shop on a phone**: account page no longer wider than the screen, 16-pixel form fields (stops iPhone zoom), 44-pixel tap targets, bottom bar clear of the home indicator, browser bar takes the shop's colour.

## Branding
- "Powered by Anknovate IT Services" in the footer.

## Documentation and testing
- This documentation set, and the end-to-end browser checks added to the repository (`npm run e2e`).

## Known gaps (carried forward)
- No phone or email verification at sign-up; no two-step sign-in for staff; no email invitation for new staff.
- Rate limits are per server process (single instance only).
- No Content-Security-Policy on the main pages.
- No automatic data deletion or export for privacy requests.
- Real-shop page reading, real payments and real message delivery cannot be tested automatically and need checking on the live site.
- Legal, tax, customs-duty and payment-licensing questions are not addressed by the software.
