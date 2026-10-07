# 5. Deployment and operations

For the developer who runs the server. The step-by-step deployment recipes are also in [`DEPLOY.md`](../DEPLOY.md) at the top of the repository; this document adds the reasoning, the full settings reference and the runbooks.

## 5.1 What the server needs

The shop is **one Node.js server** that keeps its data in **one SQLite file** and runs its background jobs **inside the same process**. So the host must provide:

| Requirement | Why |
| --- | --- |
| A **persistent disk** | The database file, and uploaded photos and logos (stored in an `uploads` folder next to the database file), live on it. |
| **Exactly one always-running instance** | SQLite allows one writer, sign-in throttles are kept in memory, and the catalogue scheduler and message retries run inside the server. Two instances would fight over the file and double-run jobs. |
| **HTTPS** | Cookies are marked `Secure` in production, and payment gateways require HTTPS return and webhook addresses. |
| Node.js 22 (supplied by the Docker image) | The app targets Node 22. |

Serverless hosts (Vercel, Netlify, Cloudflare Workers) **will not work**: no persistent disk and no always-on process. Render, Fly.io, Railway or any VPS with Docker all work.

## 5.2 The current deployment (Render)

| Item | Value |
| --- | --- |
| Host | Render, **Web Service**, Docker runtime |
| Service name | `ukgh-shop` (from `render.yaml`) |
| Region | **Frankfurt** (closest to Ghana and the UK). A region cannot be changed after the service exists. |
| Plan | **Starter** (a persistent disk needs a paid instance) |
| Disk | `shopdata`, **1 GB**, mounted at `/data` |
| Database file | `/data/shop.db` (`DATABASE_PATH`) |
| Health check | `/api/health` |
| Code | GitHub repository `Princegates/Ecommerce-UK-Shopping`, branch deployed from Render |
| Address | `https://ukgh-shop.onrender.com` (until you add your own domain) |

**Updating the live site:** push code to the branch Render watches (or press **Manual Deploy** in Render). The Docker image rebuilds and the server restarts. Database changes are applied automatically at start. Expect a short interruption while it restarts.

**Container start-up:** `docker-entrypoint.sh` makes the data folder writable for the app user and then drops root privileges (user id 10001) before starting the server.

## 5.3 Settings reference

Set these as **environment variables** on the host (Render → service → **Environment**). Anything you leave out of the environment can still be saved in **Admin → Integrations** for provider keys; **an environment value always wins** over a saved one.

### Required in production
| Variable | Purpose |
| --- | --- |
| `APP_URL` | The public address, `https://…`, no trailing slash. Used for payment return links, webhook addresses and the links in messages. It is **never** read from request headers. Without an `https` value, customers cannot be messaged their link-order pay links. |
| `ADMIN_PASSWORD` | The **super admin** password. A long passphrase. **Only the developer should know it.** |
| `ADMIN_SECRET` | 16 or more random characters. Signs admin sessions. Changing it signs everyone out of the admin. **If you have not set `SETTINGS_ENCRYPTION_KEY`, the saved keys are encrypted with this value, so changing it would also make them unreadable. Always set a separate `SETTINGS_ENCRYPTION_KEY`.** |
| `SETTINGS_ENCRYPTION_KEY` | 16 or more random characters. Encrypts provider keys and feed addresses saved in the database. **If you lose or change it, saved keys become unreadable** and must be entered again. Falls back to `ADMIN_SECRET` if unset. |
| `CRON_SECRET` | 16 or more random characters. Protects the `/api/cron/*` endpoints (they answer 404 until it is set). |
| `DATABASE_PATH` | The database file, e.g. `/data/shop.db` (the Docker image sets this). |

Generate random values with `openssl rand -base64 32`.

### Optional
| Variable | Purpose | Default |
| --- | --- | --- |
| `ALLOW_DEMO_PAYMENTS` | Enables the pretend payment page. **Leave unset in production.** | off in production |
| `INGEST_AUTORUN` | `false` turns off the built-in catalogue scheduler (use `/api/cron/ingest` instead). | on |
| `SEED_SAMPLE_DATA` | `true` creates made-up sample shops on a **new** database. **Development only.** | off |
| `UPLOAD_DIR` | Where uploaded photos are stored. | `uploads` next to the database |

### Provider keys (environment or Admin → Integrations)
| Provider | Variables |
| --- | --- |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CHARGE_CURRENCY` (GBP or GHS) |
| Paystack | `PAYSTACK_SECRET_KEY` |
| Flutterwave | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH` |
| Arkesel (SMS) | `ARKESEL_API_KEY`, `ARKESEL_SENDER_ID` |
| Twilio (SMS and WhatsApp) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_CONTENT_SID` |
| Meta WhatsApp Cloud API | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_GRAPH_VERSION` (default v22.0) |
| Resend (email) | `RESEND_API_KEY`, `RESEND_FROM` |
| Postmark (email) | `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM`, `POSTMARK_MESSAGE_STREAM` (default outbound) |
| eBay | `EBAY_APP_ID`, `EBAY_CERT_ID`, `EBAY_ENVIRONMENT` (production or sandbox) |
| ExchangeRate-API | `EXCHANGERATE_API_KEY` |
| Open Exchange Rates | `OPENEXCHANGERATES_APP_ID` |

Details of each provider are in [Integrations](09-integrations.md).

## 5.4 First deployment, step by step

1. Prepare the settings in 5.3.
2. Create the service (Render: **New → Blueprint**, select the repository; `render.yaml` creates the service and disk).
3. Open `https://<address>/api/health`. It should answer `{"ok":true}`.
4. Sign in as the super admin at `/admin/login?developer=1`.
5. Work through the [first-day checklist](02-admin-guide.md#2-your-first-day-set-up-checklist).
6. Register each payment gateway's **webhook address** (shown on its card) and press **Test**.
7. Place a real small order end to end before announcing the shop.

### Other hosts
- **Any server with Docker:** `cp .env.example .env.production`, fill it in, then `DOMAIN=shop.example.com docker compose up -d --build`. Caddy fetches and renews the HTTPS certificate. Data is in the `shopdata` volume.
- **Fly.io:** `fly launch --no-deploy --copy-config`, `fly volumes create shopdata --size 1 --region lhr`, set the secrets, `fly deploy`, `fly certs add <domain>`. `fly.toml` keeps one machine always on.

### Your own domain
Add the domain in the host (Render → service → **Settings → Custom Domains**), create the DNS records it shows, wait for the certificate, then change `APP_URL` to the new address and **update every gateway's webhook and return address** to match.

## 5.5 Scheduled jobs

| Job | Runs | Notes |
| --- | --- | --- |
| Catalogue sources | Built in, every 10 minutes (first run 1 minute after start) | Each source has its own interval (default 24 hours). To run elsewhere: `INGEST_AUTORUN=false` and call `GET /api/cron/ingest`. |
| Message retries | Messages are also sent right after an event; failed ones are retried | Call `GET /api/cron/messages` every few minutes from a scheduler for reliability. |
| Exchange-rate sync | Only if you use a rate feed | Call `GET /api/cron/fx` hourly or daily. |

Call cron endpoints with `Authorization: Bearer $CRON_SECRET`, for example:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/messages
```
On Render you can use a **Cron Job** service for this.

## 5.6 Backups (set up before you take orders)

All data is in **one file**, which is in **WAL mode**. A plain copy of `shop.db` while the server runs can miss recent writes, so use SQLite's backup function, not `cp`.

Open a **Shell** on the Render service and run:
```bash
node -e "const D=require('better-sqlite3');new D(process.env.DATABASE_PATH).backup('/data/backup-'+Date.now()+'.db').then(()=>{console.log('backup done');process.exit(0)})"
```
Then **copy the backup off the machine** (a backup that lives on the same disk is not a backup). Also copy the `/data/uploads` folder, which holds uploaded photos and logos.

Better options: Render **disk snapshots** (restorable from the dashboard; check Render's current documentation for how often they are taken and how long they are kept), or [Litestream](https://litestream.io) streaming the database to object storage continuously.

**Test a restore** at least once: stop the server, put a backup in place as `shop.db` (delete any `shop.db-wal` and `shop.db-shm`), start the server, and check you can sign in and see orders.

## 5.7 Monitoring

- **Health:** `GET /api/health` returns `{"ok":true}` if the server is up and can read the database, otherwise `503`. Point an uptime monitor (UptimeRobot, Better Stack) at it.
- **Logs:** Render → service → **Logs**. Lines starting `[ingest]` come from the catalogue scheduler; `[webhook:<provider>]` from payments; `[orders]`, `[audit]` and `[request]` from the matching areas. Secrets are never logged.
- **In the admin:** the Dashboard **Needs attention** list, **Messages** (failed sends), **Catalogue sources** (stopped sources) and **Integrations → Readiness**.
- **Disk:** the 1 GB disk holds the database and uploads. Check usage in Render → **Disks** now and then and enlarge it before it fills.

## 5.8 Runbooks

### Redeploy or roll back
- **Redeploy:** Render → **Manual Deploy → Deploy latest commit**.
- **Roll back code:** Render → **Deploys** → pick an earlier deploy → **Rollback**. Database changes only ever move **forward** and are additive, so older code normally still runs, but test a rollback on a copy before relying on it. Take a backup before any risky deploy.

### I lost the super admin password
Set a new `ADMIN_PASSWORD` in the host's environment and redeploy. Existing staff accounts are unaffected.

### A staff member forgot their password
As the super admin: **Staff accounts → the person → Reset password**. They choose a new one at their next sign-in.

### A staff member left
Switch their account off (it signs them out immediately), then delete it when convenient.

### A key may have leaked
Rotate it at the provider, enter the new key in **Admin → Integrations** (or the environment), and press **Test**. If `ADMIN_SECRET` leaked, change it (this signs every admin out). If `SETTINGS_ENCRYPTION_KEY` leaked, change it and re-enter all saved provider keys.

### Customers say they cannot pay
Check **Integrations → Readiness** (is a gateway configured and switched on?), the gateway's dashboard for errors, and the **Needs attention** list for "Payments with the wrong amount". Confirm `APP_URL` is the live `https` address and the webhook is registered.

### Messages are not arriving
**Messages** shows failed sends and the reason. Check the provider key, sender name or template approval, and that the channel is switched on and the status is enabled under **Which updates are sent**. Press **Retry**.

### A catalogue source stopped
Open the source: the message says why. See [Catalogue sources → Troubleshooting](04-catalogue-sources.md#troubleshooting-a-source).

### The site is down
Check Render's status and **Logs**, and `/api/health`. A full disk is a common cause: free space or enlarge it. A restart (Manual Deploy) is safe.

## 5.9 Costs to expect

| Item | Notes |
| --- | --- |
| Render Starter web service | Monthly, with the persistent disk (the disk is what keeps your data). |
| Payment gateway fees | Charged by Stripe, Paystack or Flutterwave per transaction. |
| SMS / WhatsApp / email | Per message, depending on the provider. |
| Domain name | Yearly, optional at first. |
| eBay, Shopify reads | Free (eBay developer keys are free). |

Do not switch to a free plan or remove the disk: you would lose the database.

## 5.10 Not covered yet

Phone or email verification at sign-up, a shared rate-limit store for running several instances, a Content-Security-Policy header, two-step sign-in for staff, and an email invitation for new staff (the super admin gives the first password personally).
