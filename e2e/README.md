# End-to-end browser checks

`e2e.mjs` drives a real headless browser through the whole shop: browsing, search, cart, sign-up, checkout, payment (demo payments), order tracking, the admin (every page, order handling, staff accounts and access, link requests and automatic quotes, catalogue sources, file import, shop logos, shops and delivery areas, themes, uploads), and phone-sized layouts for both the shop and the admin.

It prints one `OK` line per check and `FAIL` lines for problems, and ends with `no browser errors` when the browser console stayed clean.

## Run it

```bash
npm install
npx playwright-core install chromium   # once, unless you set CHROMIUM_PATH to an existing Chrome or Chromium
npm run e2e
```

`npm run e2e` (which runs `e2e/run.sh`) builds the shop, starts it on a **throwaway** database with sample data and demo payments, runs the checks and stops the server. Your real data is never touched.

## Settings

| Variable | Meaning | Default |
| --- | --- | --- |
| `CHROMIUM_PATH` | A Chrome or Chromium to use | Playwright's own |
| `E2E_PORT` | Port for the temporary server | 3100 |
| `E2E_ADMIN_PASSWORD` | Super admin password the temporary server uses | `admin` |
| `E2E_CRON_SECRET` | Cron secret the temporary server uses | `cron-secret-123456` |
| `E2E_BASE` | Test an **already running** server instead (run `node e2e/e2e.mjs` directly) | `http://localhost:3100` |

Do **not** point the checks at your live site: they create customers, orders, staff accounts, shops and sources.

## Notes
- The sandbox these checks were developed in cannot reach retailer websites, so checks that need a **real shop page** (for example reading a price from a live product page) use a faked answer or only prove that the page refuses private addresses. Try those on the live site by hand.
- The checks are sequential and share state (for example the customer registered early is used later), so run the whole file rather than parts of it.
