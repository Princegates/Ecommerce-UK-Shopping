# 4. Catalogue sources

How products get onto the site, and the rules the importer follows. Everything here is under **Admin → Catalogue sources** (needs the *Manage catalogue sources* right; approving imports needs *Review imported items*).

## The idea

A **source** is one place you are allowed to read a shop's products from. Each source belongs to one of your **shops** and has its own schedule. When it runs, it **reads**, **checks**, then either **publishes** automatically or holds items for **review**.

A new database starts with one shop, **eBay UK**, and nothing else. Nothing fictional is created in production.

## Choosing the right kind

| Kind | Best for | What you give it | Notes |
| --- | --- | --- | --- |
| **Product feed (CSV or JSON)** | Official and affiliate feeds (Awin, CJ, Rakuten, Impact…) | The feed address | The most reliable: prices, stock and images come from the shop. Columns are recognised automatically; override with lines like `price=cost.gbp`. |
| **eBay (official API)** | Real UK listings with photos | Free eBay developer keys (Admin → Integrations → Catalogue APIs) and your searches, one per line (up to 10) | Only new, fixed-price, UK-located listings priced in pounds. Search results vary, so a missing listing is never treated as removed. |
| **Diffbot (Product API)** | Product pages you list, when you hold or are allowed the data | Your Diffbot token (Admin → Integrations → Catalogue APIs) and the product page addresses, one per line | Paid: one Diffbot credit per product on every run. Diffbot returns name, price, was-price, stock, brand and photo. Only prices in pounds are used. The shop's `robots.txt` is checked first and a disallowed page is skipped without calling Diffbot. The shop's terms still apply because Diffbot reads the page for you. |
| **WooCommerce shop** | Small UK shops on WooCommerce | The shop's main address, for example `https://shop.co.uk` | Reads the public product list (`/wp-json/wc/store/v1/products`) only if the shop's `robots.txt` allows it and the shop prices in pounds. Brings sizes and colours across as choices. Products sold on another website, grouped products, and products whose sizes cost different amounts are skipped. Weight is not published, so the source's default weight is used. Get the owner's agreement first. |
| **Shopify shop** | Small UK brands on Shopify | The shop's main address, for example `https://brand.co.uk` | Reads the public product list only if the shop's `robots.txt` allows it and the shop prices in pounds. Brings sizes and colours across as choices. Products whose sizes cost different amounts are skipped (the site holds one price per product). Get the owner's agreement first. |
| **Shop website (sitemap + pages)** | Shops whose terms and `robots.txt` allow it | The sitemap address | Reads product data (JSON-LD or Open Graph) from each page, one at a time, slowly. |
| **File import (CSV or JSON)** | Data you collected yourself, for example a spreadsheet | Create the source, then upload the file on its page | Nothing is fetched from any shop. Prices must be in pounds. Re-uploading the same file updates prices and stock. A file never removes products. Items disappear after the "hide items not refreshed" days unless you upload again. |
| **Pasted links** | One-off items | Up to 20 links at a time | Prices are re-checked automatically. |

### How to tell if a shop's list is readable on WooCommerce
Open `theirshop/wp-json/wc/store/v1/products` in a browser. A readable shop shows a long block of text starting with `[{"id":` and containing `"currency_code":"GBP"`. A login page, an error, or `rest_no_route` means the list is switched off or the shop is not on WooCommerce, so it cannot be used.

### How to tell if a shop is on Shopify
Open `theirshop/meta.json` in a browser. A Shopify shop shows text containing `"currency":"GBP"`; any other site shows an error page.

### Large retailers
Many large UK retailers (for example Amazon, Argos, Tesco, Asda, Currys, Next, M&S, B&Q) **forbid or block** automated reading, and that includes a service such as Diffbot reading their pages for you. The importer will stop if they refuse. For them use an **affiliate feed**, or handle their products as **link orders** ([Admin guide → Link orders](02-admin-guide.md#5-link-orders-in-detail)).

## Setting up a source

1. **Add a source**, choose the **shop** the items belong to and the **kind**.
2. Enter the address (or searches), and optionally **column names** for feeds.
3. Tick the **permission box**: you confirm you have checked the shop's terms or hold a licence for the data. **A source cannot be switched on without it.**
4. Click **Check this setup first**. It shows a few items and any problems without saving anything.
5. **Create source**, then **Run now** (or wait for the schedule).

### Settings on a source
| Setting | Meaning | Default |
| --- | --- | --- |
| Switch on | Runs on its schedule | on when created |
| Publish new items automatically | New items go live without review | on |
| Update prices and stock automatically | Changes to live items apply by themselves | on |
| Hold a price move bigger than (%) | Bigger jumps wait in Import review | 40 |
| Run every (hours) | How often it runs | 24 |
| Hide items not refreshed for (days) | So an old price never stays on sale | 14 |
| Items per search / Pages / Products per run | Size of each run (up to 500) | 50 |
| Seconds between page requests | At least 2; a longer `Crawl-delay` in `robots.txt` always wins | 3 |
| Category and weight when the shop gives none | Used for shipping | weight 500 g |

## What runs by itself

The scheduler inside the server wakes every **ten minutes** and runs each source that is on and due. It then hides items that have not been refreshed for too long. To run it from your own scheduler instead, set `INGEST_AUTORUN=false` and call `GET /api/cron/ingest` with the cron secret.

For each item it reads:
- **New** → published (unless auto-publish is off or a check fails).
- **Changed price, was-price, stock or photo** → the live product is updated (unless it fails a check, then it is **held**).
- **Disappeared from a complete feed** → hidden. This happens only for complete feeds, and only if at least half of the previous items are still there (so a half-empty feed cannot wipe your shop).
- **Not refreshed within the stale window** → hidden.

### Checks that send an item to review
- Price under **50p** or over **£10,000**.
- Name shorter than 3 characters, or no link back to the shop.
- A price move bigger than the source's limit.
- Any update, if you turned automatic updates off.

## Rules the importer follows (and will not break)

- It identifies itself as **ShopCatalogBot**, with a page shops can read (`/bot`).
- It obeys **`robots.txt`** and any **`Crawl-delay`**, and waits at least two seconds between requests to one shop.
- It never reaches private or internal addresses, and only uses ports 80 and 443.
- When a shop answers **401, 403, 429, 451**, or shows a verification page, it **stops**, **pauses that source for 24 hours**, and tells you. It **never** retries with another identity, rotates addresses, or tries to get past CAPTCHAs or blocks. Switching the source off and on again clears the pause.
- Only **prices in pounds** are accepted.
- Feed addresses (which often contain keys) are stored **encrypted**.
- Only one run per source at a time (a lock expires after 30 minutes).
- Images are **linked** from the source, not copied. Confirm your licence covers showing them.

## Removing a source
Open the source → **Remove this source**. Choose **keep its products** (they stay on the shop but stop being refreshed, so their prices can go out of date) or **remove its products** (they disappear from the shop, carts and wishlists). Orders already placed keep their own record. A source with a run in progress cannot be removed.

## Troubleshooting a source

| You see | Likely cause | What to do |
| --- | --- | --- |
| "Blocked by the shop… HTTP 403" | The shop refuses automated reading | Do not retry. Use an affiliate feed, or link orders. Remove or switch off the source. |
| "Add your eBay App ID and Cert ID…" | eBay keys are missing or eBay is off | Enter them under Integrations → Catalogue APIs and switch eBay on. |
| "That address does not look like a WooCommerce shop, or its product list is switched off" | Not WooCommerce, or the shop turned the public list off | Try the `/wp-json/wc/store/v1/products` test above. |
| "That address does not look like a Shopify shop" | Not a Shopify shop (no `/meta.json`) | Check the address; try the `/meta.json` test above. |
| "This shop prices in USD, not pounds…" | The shop's currency is not GBP | It cannot be used. |
| Many items "skipped: variants have different prices" | Sizes cost different amounts | Those products are skipped by design. |
| Items keep going to Import review | Prices look odd or jump a lot | Check the feed; raise the limit only if the moves are real. |
| Items disappear after two weeks | The stale window passed | Make sure the source is on and running, or lengthen the window. |
