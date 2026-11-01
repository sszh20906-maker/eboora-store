# Eboora V56 — Final security and quality audit

## Changes in this release
- Added a one-year HSTS response header with `includeSubDomains` to the site's existing shared security-header policy.
- Added a regression test for the shared security headers and no-store caching on API/admin routes.
- Re-ran the project's complete automated test suite, including payment, webhook, download, authentication, product, checkout, theme, gallery, thank-you, analytics, management and site-settings tests.

## Verification results
- `npm run check`: PASS.
- `npm run golive`: BLOCKED by four legal placeholders that still require the owner's real business details:
  - `terms.html`: full business address and applicable jurisdiction.
  - `privacy.html`: business address, city, state and PIN.
  - `refund.html`: full business address, city, state and PIN.
- A test log includes expected simulated failure-path messages (for example, unavailable email delivery and mock database tables); the corresponding tests pass. This is not evidence of a live payment failure.

## Mandatory before production
1. Replace the legal placeholders with accurate business details and have the policies reviewed for the business and applicable law.
2. Confirm Cloudflare Pages output directory is `public`, D1 binding `ORDERS_DB`, and R2 binding `PRODUCTS_BUCKET` are configured.
3. Confirm the required Cloudflare secrets are present: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`, `DOWNLOAD_TOKEN_SECRET`, `RESEND_API_KEY`, `FROM_EMAIL`; configure optional owner/Meta secrets only if used.
4. Confirm the D1 schema/migrations are applied, including payment receipt/idempotency tables and rate-limit/notification tables.
5. Configure Cashfree's production webhook URL and enable the appropriate success/failure events; use production mode only after merchant approval.
6. Complete a real low-value end-to-end test purchase, verify the webhook, email and download, and confirm no duplicate charge or duplicate delivery.
7. Check the deployed site on a real Android device and desktop browser. Automated tests cannot validate Cloudflare account bindings, real Cashfree credentials, email delivery, analytics events or physical-device rendering.

## Important limitations
This release does not claim that the production Cloudflare deployment, live Cashfree transaction, real webhook delivery, real email delivery, or physical Android/desktop browser tests have been performed. HSTS should only be deployed on an HTTPS-only domain; `includeSubDomains` assumes every subdomain also supports HTTPS.
