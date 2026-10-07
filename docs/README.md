# SHOP UK FROM GH: documentation

SHOP UK FROM GH lets shoppers in Ghana buy from UK shops and pay once, in cedis. The team buys the items in the UK, ships them to Ghana, and a courier delivers.

This folder holds everything written about the system. Start with the guide for your job.

## Read this first, by role

| If you are… | Start here |
| --- | --- |
| **The business owner or operator** (you run orders day to day) | [Overview](01-overview.md), then the [Admin guide](02-admin-guide.md) |
| **Staff** (support, operations, catalogue, finance) | The [Admin guide](02-admin-guide.md) sections for your role, and the [permissions table](02-admin-guide.md#7-staff-accounts-and-access) |
| **Customer support** (answering customers) | The [Customer guide](03-customer-guide.md) and the [FAQ and troubleshooting](11-faq-and-troubleshooting.md) |
| **The developer** (runs the server, owns the super admin password) | [Deployment and operations](05-deployment-and-operations.md), [Architecture](06-architecture.md), [Security](08-security.md) |
| **Product owner, auditor or anyone checking what the system must do** | The [Software Requirements Specification](13-srs.md) |
| **A new developer joining** | [Architecture](06-architecture.md), [Data model](07-data-model.md), [Testing](10-testing.md) |

## All documents

1. [Overview](01-overview.md): what the system is, how an order flows, how prices are worked out, glossary.
2. [Admin guide](02-admin-guide.md): every admin page, daily routines, link orders, staff accounts and access.
3. [Customer guide](03-customer-guide.md): how shoppers use the site, written so you can reuse it as help text.
4. [Catalogue sources](04-catalogue-sources.md): how products get onto the site (eBay, Shopify, feeds, file import, pasted links) and the rules the importer follows.
5. [Deployment and operations](05-deployment-and-operations.md): hosting on Render, settings, backups, updating, monitoring, costs.
6. [Architecture](06-architecture.md): technology, folder map, how a request flows, background jobs.
7. [Data model](07-data-model.md): every database table and how they relate.
8. [Security and privacy](08-security.md): sign-in, access control, secrets, protections, personal data, what is not covered.
9. [Integrations](09-integrations.md): payment, SMS, WhatsApp, email, exchange-rate and eBay providers, webhooks and scheduled jobs.
10. [Testing](10-testing.md): the automated checks and how to run them.
11. [FAQ and troubleshooting](11-faq-and-troubleshooting.md): common questions and fixes.
12. [Change history](12-change-history.md): what was built, in order.
13. [Software Requirements Specification (SRS)](13-srs.md): the formal, numbered requirements (functional, interface, quality, data, business rules, use cases, risks) with the status of each and how it is verified.

## Facts worth knowing before you read anything

- The site is **one server with one database file** (SQLite) on a persistent disk. It must run as a single always-on instance.
- There are **two kinds of admin sign-in**: the **super admin** (the developer's `ADMIN_PASSWORD`, at `/admin/login?developer=1`) and **staff accounts** (email and password at `/admin/login`) created by the super admin.
- Customers **cannot pay online until you set up at least one payment gateway** in Admin → Integrations.
- The documents describe the system as built. Anything marked **not covered** or **not built** is genuinely missing, not hidden.
- These documents are not legal, tax or customs advice. Take advice on consumer terms, VAT, import duty, payment licensing and data protection before you take money.
