# 8. Security and privacy

What protects the system, what personal data it holds, and what is not covered. This describes the code as built; it is not a legal opinion.

## 8.1 Who can sign in, and how

| Who | Credential | Protection |
| --- | --- | --- |
| **Super admin** | `ADMIN_PASSWORD` (a server setting) at `/admin/login?developer=1` | Not stored in the database. Compared in constant time. Cannot be edited or switched off from the admin. |
| **Staff** | Email and password at `/admin/login` | Passwords hashed with **scrypt** (N=2¹⁵, r=8, p=3, random salt). Minimum **10 characters**, common passwords refused. New accounts must choose their own password before anything else opens. |
| **Customers** | Phone (or email) and password, or Google, Facebook or Apple | Passwords: same scrypt hashing, minimum 8 characters, common passwords and a password containing the phone or email refused. Provider sign-in: see below. |

### Sessions
- **Admin:** a signed cookie (`admin_session`), HMAC-SHA256 with `ADMIN_SECRET`, `HttpOnly`, `SameSite=Lax`, `Secure` in production, limited to `/admin`, valid **8 hours**. A **staff** session also carries the account's **session version**, which is re-checked against the database on **every request**. Switching an account off, changing its rights or resetting its password raises the version, so open sessions end **at once**.
- **Customers:** a random token in a `HttpOnly`, `SameSite=Lax`, `Secure`, `__Host-` prefixed cookie, valid **30 days**; only a **hash** of the token is stored. Customers can sign out other devices.
- **Password resets:** a random one-time token valid **60 minutes**, stored hashed; a successful reset signs the customer in and ends other sessions.

### Sign in with Google, Facebook or Apple
- The standard authorisation-code flow over HTTPS. Each attempt carries a random **state**, a **nonce** and (Google) a **PKCE** challenge, lasts **10 minutes**, can be used **once**, and is tied to the browser that began it by a `HttpOnly`, `Secure`, `__Host-` cookie (`SameSite=None` in production, because Apple returns the person with a cross-site form post). Only hashes of the state and the cookie value are stored.
- Google and Apple identify the person by an **ID token** received straight from the provider's token endpoint over TLS; its issuer, audience (our app), expiry and nonce are checked. Facebook's access token is exchanged for the profile with an app-secret proof.
- **Account matching:** by the provider's own id, or by an email address the provider says it has **verified** (Google, Apple). Facebook does not say, so its email never connects to an existing account; a phone number or name never does either. Such a person is told to sign in another way and connect the provider from **Account → Security**.
- Switched-off accounts cannot sign in this way. Provider secrets (and the Apple private key) are saved **encrypted**, like other integration keys. Provider sign-in is **only offered when `APP_URL` is an https address**.
- A first-time sign-in must add a phone number before the account exists. The account gets a random password nobody knows; the customer can choose one through "Forgot your password".
- Start and return addresses are rate-limited per connection.

### Throttles (kept in memory, per server)
| What | Limit |
| --- | --- |
| Admin sign-in | 5 failures per place, and 8 per email, per 15 minutes |
| Customer sign-in | 15 per place and 6 per account per 15 minutes |
| Customer sign-up | 10 per place per hour |
| Password reset requests | 6 per place and 3 per account per hour |
| Order lookup by number | 8 failures per 15 minutes |
| Orders placed | 10 per place per hour |
| Link requests | 6 per place per hour |
| Link preview | 12 per place per 10 minutes |
| Search suggestions | 120 per place per minute |
| Payment return checks | 20 per place per 10 minutes |

Unknown emails take the same time to reject as wrong passwords, so account existence is not leaked by timing.

## 8.2 Access control (roles and rights)

- The **super admin** can do everything and is the **only** one who can manage staff accounts. That right is not in the list of rights and can never be granted.
- Each **staff** account holds a list of **rights** (see the [table in the Admin guide](02-admin-guide.md#7-staff-accounts-and-access)). The roles are presets that tick rights; the super admin can tick exactly what a person needs.
- **Every admin page and every admin action checks a specific right on the server**, not just in the menu. Typing the address of a page you cannot use shows **No access**. The orders download is checked too.
- Staff cannot grant themselves more access. Changing or removing access takes effect immediately (session version).
- A test fails the build if an admin page or action has no access check. See [Testing](10-testing.md).
- The **activity log** records sign-ins and every administrative action with the person's name and email.

## 8.3 Money and payments

- **Card data never touches this server.** Customers pay on the gateway's own hosted page.
- Prices are **always recalculated on the server** from live settings when an order is created; the browser's figures are never trusted.
- A payment is marked paid only after the **amount and currency** match what was asked for. A mismatch is flagged on the dashboard ("Payments with the wrong amount") and does not mark the order paid.
- **Webhooks:** the signature is verified on the raw body before anything is read; for gateways whose webhook is only authenticated by a shared secret, the payment is **re-checked with the gateway** first; each event is applied **once**; bodies over 1 MB are refused; failures return 500 so the gateway retries.
- Only a confirmed payment moves an order to *Payment received*; staff cannot mark an order paid.
- Link-order quotes use a long random private token, expire, and cannot create two orders.

## 8.4 Secrets

- Provider keys and catalogue feed addresses saved in the admin are encrypted with **AES-256-GCM** using `SETTINGS_ENCRYPTION_KEY` (or `ADMIN_SECRET` if that is not set).
- Keys are shown **masked** in the admin and are never written to logs or the activity log.
- An environment setting always overrides a saved key.
- The public address (`APP_URL`) is never taken from request headers, so a forged `Host` header cannot redirect customers or payments.

## 8.5 Other protections

| Area | Protection |
| --- | --- |
| **Network fetches by the importer** | Only http/https on ports 80 and 443, no credentials in addresses, no private or internal addresses (checked again when the name is resolved), at most three redirects (each re-checked), size and time limits, obeys `robots.txt`, stops on refusals. Prevents the server being used to reach internal systems. |
| **Uploads** | Photos and logos are accepted by **file content** (JPEG, PNG, WebP, GIF), not by name; up to 4 MB; stored under random names; served with a fixed type, `nosniff` and a `sandbox` content policy so an upload can never run as a page; path tricks are blocked. |
| **Cookies and sessions** | `HttpOnly`, `SameSite=Lax`, `Secure` in production. |
| **Response headers** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` that turns off camera, microphone and location, and `Strict-Transport-Security`. The `X-Powered-By` header is removed. |
| **Cron endpoints** | Answer 404 until `CRON_SECRET` is set, then need `Authorization: Bearer …`. |
| **Admin and search engines** | `/admin`, `/account`, `/cart`, `/checkout`, `/pay/`, `/order/`, `/quote/` and similar are disallowed in `robots.txt`. |
| **SQL** | All queries use bound parameters. |
| **Link previews** | Rate limited; never reach private addresses; obey `robots.txt`. |

## 8.6 Personal data held

| Data | Where | Notes |
| --- | --- | --- |
| Customer name, phone, optional email, password hash, notification choices, default area | `customers` | Password is hashed. |
| Saved delivery addresses | `customer_addresses` | Up to 10 per customer. |
| Sessions | `customer_sessions` | Token hash and a shortened browser description. |
| Orders: name, phone, email, delivery address, landmark, notes, items, amounts | `orders`, `order_items` | Kept as the business record of a sale. |
| Link requests: link, details, name, phone, email | `link_requests` | |
| Messages: recipient, text | `messages` | Recipients are partly hidden in the admin. |
| Reviews | `reviews` | Shown as first name and last initial. |
| Staff: name, email, password hash, rights, last sign-in | `admin_users` | |
| Activity log | `audit_log` | Staff names and emails as actors. |

**What deleting an account does:** a customer can delete their account (Security page). The account, addresses, wishlist, sessions and reset links are removed; reviews are kept but shown as "Former customer"; link requests are detached from the account. **Orders are kept** (without the link to an account) because they are the record of a sale and contain the delivery details used. Decide your own retention period for old orders and requests; the system does not delete them automatically.

**Where data goes:** customer contact details are sent to the message providers you enable (to deliver messages), and name, phone and email go to the payment gateway during payment. Photos are shown from their original sources when imported.

## 8.7 Not covered (be aware)

- **Phone or email verification** at sign-up.
- **Two-step sign-in** for staff or the super admin.
- A **shared rate-limit store**: throttles are per server process and reset on restart (fine for one instance).
- A **Content-Security-Policy** for the main pages (uploads have a strict one).
- **Automatic data deletion** or export for privacy requests; do these by hand.
- **Legal and tax matters**: consumer terms, refunds policy, VAT, import duty, payment licensing and data-protection registration (for example with Ghana's Data Protection Commission, and UK/EU rules if you serve those users). Get professional advice.

## 8.8 If something goes wrong

| Event | Do this |
| --- | --- |
| A staff account may be compromised | Super admin: switch it off (signs it out at once), reset its password, check the **Activity log**. |
| A provider key leaked | Rotate it at the provider, update it in Integrations, press **Test**. |
| `ADMIN_SECRET` leaked | Change it and redeploy (signs everyone out of the admin). Set a separate `SETTINGS_ENCRYPTION_KEY` first so saved keys stay readable. |
| The super admin password leaked | Set a new `ADMIN_PASSWORD` and redeploy. |
| Suspicious payments | Check the gateway dashboard and the "wrong amount" list; do not ship until reconciled. |
| Customer data exposed | Follow your legal duties to notify; rotate secrets; review the activity log. |
