# Eboora-Store: what you must connect manually

This project already includes code for Meta Pixel browser events, Meta Conversions API Purchase events, and automatic purchase/download emails. These features stay inactive until the account-specific values and Cloudflare resources are configured.

## Manual tasks after publishing

### 1) Meta Pixel (browser events)
1. Create/open the Pixel in Meta Events Manager and copy the numeric Pixel ID.
2. Open `/admin.html`, enter the Pixel ID under **Meta Pixel ID**, export `store-config.json`, replace the deployed file, and redeploy.
3. In Cloudflare Pages → Settings → Variables and Secrets, set `META_PIXEL_ID` to the same ID.
4. Check PageView and ViewContent in Meta Events Manager.

### 2) Meta Conversions API (server-side Purchase)
1. Create a Conversions API access token in Meta Events Manager for that Pixel/dataset.
2. Add `META_CAPI_TOKEN` as an encrypted secret in Cloudflare Pages; never put it in HTML or `store-config.json`.
3. For testing only, set `META_TEST_CODE` to the Test Events code shown in Events Manager.
4. Make a Cashfree sandbox purchase and confirm Purchase appears. Browser/server Purchase uses the same order ID for deduplication.
5. Remove `META_TEST_CODE` after testing. Do not treat events as production-ready until tested.

### 3) Automatic purchase email
1. Create a Resend account and verify the sender domain/address you will use.
2. Set `RESEND_API_KEY` as an encrypted Cloudflare secret.
3. Set `FROM_EMAIL` to the verified sender (example format: `Eboora-Store <downloads@your-verified-domain>`).
4. Set `REPLY_TO` to a real inbox that you check.
5. Test a sandbox payment and confirm the email arrives, the download link works, and the email does not land in spam.

### 4) Private file delivery and order records
1. Create a private Cloudflare R2 bucket and bind it as `PRODUCTS_BUCKET`.
2. Upload the real product ZIP to R2 using the exact `PRODUCT_FILE_KEY` value.
3. Create a Cloudflare D1 database, run `schema.sql`, and bind it as `ORDERS_DB`.
4. Configure `DOWNLOAD_TOKEN_SECRET` as an encrypted secret (random, at least 32 characters).
5. Confirm only a verified, paid order can download the private file.

### 5) Cashfree (after site/domain is live)
1. Add matching sandbox credentials as encrypted Cloudflare secrets: `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`; set `CASHFREE_ENV=sandbox`.
2. Set `SITE_URL` to the final HTTPS domain and set `PRODUCT_PRICE_INR`, `PRODUCT_ID`, `PRODUCT_NAME`, `PRODUCT_FILE_KEY`, and `PRODUCT_FILENAME` consistently with the actual product.
3. Add the webhook URL `https://YOUR_DOMAIN/api/cashfree-webhook` in Cashfree and configure its signing secret.
4. Test payment success, failure, webhook verification, order verification, download, and email in sandbox. Only use production credentials after Cashfree approval and all tests pass.

## Important missing functionality / current limits

- **This build is one product per deployment.** It is not yet a multi-product catalogue where the owner adds many products, uploads files, edits each price and publishes/unpublishes products from one persistent admin dashboard.
- `/admin.html` is a static editor that exports `store-config.json`; it does not save to the live database and does not upload private product files.
- There is no authenticated multi-product admin API/dashboard yet. Do not expose a future admin write API without authentication and authorization.
- Real Cashfree sandbox/live payments, actual inbox delivery, Meta events, and Cloudflare bindings have not been verified against your accounts. Local mocked tests are not proof of live operation.
- Replace example product copy, sample cover, support email, prices, and policy text with accurate business/product information before public launch.

## What you should not buy yet

You do not need a paid Meta Pixel subscription or a paid CAPI product. Start with suitable free tiers for Cloudflare and Resend where available. Domain purchase, payment processing fees, and any service usage beyond free quotas may cost money. Check current provider pricing before committing.
