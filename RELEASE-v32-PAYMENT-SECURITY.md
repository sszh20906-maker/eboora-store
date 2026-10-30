# Eboora v32 — Payment webhook hardening

## Changes
- Cashfree signed webhooks reject missing/invalid/stale timestamps (>24h old, >5min future). Window accommodates delayed retries; adjust only after checking Cashfree retry policies.
- `cf_payment_id` is required on success events. A D1 `payment_receipts` table with a unique primary key prevents one payment ID being applied to different orders. Same payment ID for the same order remains retryable.
- FAILED webhook now acknowledges an unsuccessful *attempt* without setting the entire order to FAILED. Only SUCCESS settles an order; the Cashfree API remains authoritative for customer-facing verification.
- Existing email and owner notification idempotency mechanisms retained.
- Tests added for stale signed webhook and cross-order payment ID reuse; existing tests updated.

## IMPORTANT: Deploy in this order
1. Back up your production D1 database. Find the binding/database name in `wrangler.toml`.
2. Run `npx wrangler d1 execute <YOUR_DATABASE_NAME> --remote --file=./v32-payment-security.sql` from the project directory. Replace the placeholder with the real D1 database name; verify Cloudflare account/project before running.
3. Run `npm run check` locally.
4. Only after successful migration, push the v32 code to GitHub/Cloudflare Pages.
5. Test Cashfree sandbox with real signed webhooks, retries, failed-then-successful attempts, and delivery. Mock tests are NOT live sandbox verification.

If the D1 migration is omitted, successful webhooks return 503 and orders won't be marked paid via webhook. Existing verification endpoint may still independently verify Cashfree status, but do not deploy without migration.

## Deferred
- CSP Report-Only -> enforced: needs real browser violation audit and Cashfree SDK compatibility verification.
- Cloudflare Access: configure in dashboard, protect admin API as well as admin HTML, leave public checkout/webhook reachable.
- Admin data minimization: requires UI compatibility review.
- Full transactionally atomic side-effect delivery and multi-worker race hardening: requires a durable queue/claim state design and production validation.
