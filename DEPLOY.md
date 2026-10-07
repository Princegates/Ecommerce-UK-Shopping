# Deploying the shop

The shop is one Node server with a **SQLite file** for its data and a **scheduler inside the server** (catalogue imports, message
retries). That means it needs a host with:

- a **persistent disk** for the database file (`DATABASE_PATH`), and
- **one always-running instance**.

Serverless hosts (Vercel, Netlify, Cloudflare Workers) will not work: they have no persistent disk and stop between requests.
Fly.io, Render, Railway, or any VPS running Docker all work. Run **one** instance only. SQLite is a single-writer database and the
login throttles are kept in memory.

## 1. Settings to prepare

Required (the admin and cron endpoints stay locked until these are set):

| Variable | What to put |
| --- | --- |
| `APP_URL` | Your public address, e.g. `https://shop.example.com` (https, no trailing slash). Used for payment returns and webhooks. |
| `ADMIN_PASSWORD` | A long passphrase for the admin sign-in. |
| `ADMIN_SECRET` | 16+ random characters. Signs admin sessions. `openssl rand -base64 32` |
| `SETTINGS_ENCRYPTION_KEY` | 16+ random characters. Encrypts keys saved in the admin. Keep it safe: lose it and saved keys become unreadable. |
| `CRON_SECRET` | 16+ random characters, if you call the cron endpoints. |
| `DATABASE_PATH` | `/data/shop.db` (the image already sets this). |

Payment, SMS, WhatsApp, email and exchange-rate keys can be added later in **Admin > Integrations**. Leave `ALLOW_DEMO_PAYMENTS`
unset in production. **Customers cannot pay until you configure at least one payment gateway.**

## 2. Pick a host

### Any server with Docker (simplest to reason about)

```bash
git clone <your repo> && cd <repo>
cp .env.example .env.production      # fill in the settings above
DOMAIN=shop.example.com docker compose up -d --build
```

Point your domain's DNS at the server first. Caddy fetches and renews the HTTPS certificate by itself. Data lives in the `shopdata`
volume.

### Fly.io

```bash
fly launch --no-deploy --copy-config          # edit the app name in fly.toml when asked
fly volumes create shopdata --size 1 --region lhr
fly secrets set ADMIN_PASSWORD=... ADMIN_SECRET=... SETTINGS_ENCRYPTION_KEY=... CRON_SECRET=... APP_URL=https://<your-domain>
fly deploy
fly certs add <your-domain>                   # then add the DNS records it shows
```

### Render

Push the repository to GitHub, then in Render choose **New > Blueprint** and select it. `render.yaml` creates the service and a disk.
Fill in `ADMIN_PASSWORD` and `APP_URL` when asked. A disk needs a paid instance. The blueprint uses the Frankfurt region (closest to
Ghana and the UK); a region cannot be changed after the service exists, so pick it before you add real data.

## 3. After the first deploy

1. Open `https://<your-domain>/api/health`. It should answer `{"ok":true}`.
2. Sign in at `/admin` and replace the fictional sample shops and products (or add catalogue sources).
3. **Admin > Pricing:** set the exchange rate, markup, service charge and minimum order. **Shipping** and **Delivery areas:** set your real rates.
4. **Admin > Integrations:** add a payment gateway, then the message providers. Use each card's webhook address from the page
   (`{APP_URL}/api/webhooks/stripe`, `/paystack`, `/flutterwave`) and press **Test**.
5. Place a real small order end to end with a real payment before announcing the site.
6. **Admin > Appearance:** choose a theme.

## 4. Backups (do this before you take orders)

All data is in one file. Back it up on a schedule and test a restore.

- **Fly.io:** `fly volumes snapshots list` (daily snapshots are automatic), and copy a database file off now and then with `fly ssh sftp get /data/shop.db`.
- **Docker server:** a nightly job such as
  `docker compose exec -T app node -e "const D=require('better-sqlite3');new D(process.env.DATABASE_PATH).backup('/data/backup-'+Date.now()+'.db').then(()=>process.exit(0))"`
  then copy `/data/backup-*.db` off the machine.
- **Any host:** [Litestream](https://litestream.io) streams the file to object storage continuously.

## 5. Running it safely

- Run exactly one instance, and keep it always on.
- Put it behind HTTPS (Caddy, Fly and Render all do this). The app sets security headers and `Secure` cookies in production.
- Updating: pull the new code and redeploy. Database changes are applied automatically on start.
- The catalogue scheduler runs inside the server. To run it elsewhere, set `INGEST_AUTORUN=false` and call
  `GET /api/cron/ingest` with `Authorization: Bearer $CRON_SECRET`. Do the same for `/api/cron/messages` (every few minutes) and
  `/api/cron/fx` (hourly or daily) if you use the exchange-rate feed.
- Not yet covered: phone/email verification at sign-up, a shared rate-limit store for several instances, and a Content-Security-Policy.
  Get legal and tax advice on customs duty, VAT, consumer terms and payment licensing before taking money.
