# Catalogue Source Plan

How the platform sources products, in stages.

| Stage | Approach |
|---|---|
| MVP | Buy-for-Me as the main flow, plus a small manual catalogue (3–5 retailers) |
| After 20–50 orders | Rank retailers and products by real demand |
| Phase 2 | Affiliate feeds and direct partnerships for the top retailers |
| Later | Automatic price and stock sync for integrated retailers |

Scraping is not part of the plan (SRS section 66).

## Files

- [`retailer-assessment-template.md`](retailer-assessment-template.md) — complete one per retailer before onboarding.
- [`buy-for-me-flow.md`](buy-for-me-flow.md) — customer and staff flow, statuses, quote rules.
- [`../../db/schema.sql`](../../db/schema.sql) — draft PostgreSQL schema for retailers, products, variants, price history, Buy-for-Me and quotes.

## Open decisions

1. Which 5–10 retailers first.
2. Whether each allows agent/forwarding purchases (assessment section 2).
3. Quote validity window (default 24 h).
4. Weight-difference tolerance before a balance-due is raised.
5. Restricted-goods list for `restriction_tags`.
