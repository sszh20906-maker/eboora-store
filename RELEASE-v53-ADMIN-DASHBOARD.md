# Eboora V53 — Admin Dashboard & Analytics

## Changes
- Refined the overview into a live-performance dashboard with a manual refresh action.
- Added paid revenue, paid orders, pending checkouts, today's revenue, failed payments, and cancelled-order metrics.
- Added a customer snapshot with distinct paid customer count, paid transaction count, and average paid order value.
- Added top-selling products ranked by paid order count, with revenue totals.
- Kept analytics behind the existing admin-authenticated orders endpoint; no public analytics endpoint or new database migration is introduced.
- Added responsive dashboard layout for narrow screens.

## Data definitions
- Revenue and average order value use orders with status `PAID` only.
- Customer count is distinct customer email addresses across visible paid orders.
- Product ranking uses visible paid orders joined to product metadata. If a product row is unavailable, its product ID is used as the label.
- Hidden/deleted orders are excluded using the existing admin visibility/audit model.

## Validation
Run `npm run check`. Automated checks cover the dashboard markup, rendering hooks, authenticated analytics query, and existing payment/security regressions.

Cloudflare D1 production data, deployment, and physical Android/browser appearance still require deployment-side verification.
