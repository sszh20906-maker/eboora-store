# Eboora-Store digital product storefront — Cloudflare Pages + Cashfree

A responsive digital-product landing page with a wide hero cover, mobile purchase bar, Cashfree Hosted Checkout, server-side order verification, private Cloudflare R2 delivery, transactional download emails, and optional Meta Pixel + Conversions API purchase tracking.

## What changed in this build

- Reworked the layout to be wider and more compact on desktop, with smaller headings/body type and a landscape 4:3 cover that does not dominate mobile screens.
- Added a bundled SVG cover preview and favicon so the page does not depend on a missing `cover.jpg` file.
- Added an accessible checkout dialog for buyer name, email, and phone.
- Added a server-side Cashfree order-creation API. The actual charge amount comes from Cloudflare configuration, not from the browser.
- Added D1-backed order records, verified Cashfree payment status, private R2 downloads, signed download links, and a Cashfree webhook.
- Added Resend-based download emails and Meta Conversions API tracking with the same order ID used for browser/server event deduplication.
- Added editable Privacy, Terms, and Refund pages and a basic 404 page.
- Guarded Meta Pixel initialization so placeholder pixel IDs do not run as if they were real.

## Important before you publish

This ZIP contains the implementation, but it cannot become a live store until you add your real business information, real product files, domain, Cashfree credentials, Cloudflare bindings, and email-provider credentials. These are account-specific values and cannot be safely guessed. Do not accept live payments until the sandbox checklist near the end passes.

The current product page is still an example for a product called **the configured digital product**. Verify every count, inclusion, Canva/Notion link, licence claim, update promise, response-time promise, and price against the actual digital product you sell. The bundled `assets/cover.svg` is an illustrative cover graphic, not a delivery file or proof that the advertised templates already exist. Add only genuine customer reviews.

## Files

```text
index.html                         Landing page and checkout dialog
thank-you.html                     Verifies payment before showing private download
privacy.html                       Editable privacy policy template
terms.html                         Editable terms template
refund.html                        Editable refund policy template
404.html                           Friendly not-found page
assets/cover.svg                   Wide 4:3 example cover art
assets/favicon.svg                 Store favicon
functions/api/create-order.js      Creates a Cashfree order on the server
functions/api/verify-order.js      Verifies Cashfree paid status server-side
functions/api/cashfree-webhook.js  Checks Cashfree signature; email + Meta CAPI
functions/api/download.js          Verifies order and streams private R2 file
functions/_lib/commerce.js         Shared payment/download utilities
schema.sql                         D1 database schema
_routes.json                       Routes only /api/* to Functions
wrangler.toml                      Cloudflare Pages project defaults
```


## Eboora-Store product editor

- Store branding defaults to **Eboora-Store** and is shared across product pages/configurations.
- Open `/admin.html` to edit product title, headline, description, selling price, genuine MRP (optional), cover image, benefits, inclusions, FAQs, support details and the creator/about section.
- Click **Export store-config.json**. Replace the deployed `store-config.json` with the exported file and redeploy the static site. This static build does not silently save to the live site.
- The creator/about text and store name are editable but can be kept consistent across products.
- The payment backend in this build supports **one active product per deployment**. Its product ID, price, name, filename and R2 file key must match the corresponding Cloudflare environment variables. The editor cannot change those server-side values for security reasons.
- If you want multiple products listed and purchasable simultaneously under Eboora-Store, the next step is a real multi-product admin backend (authenticated admin, product table, per-product price/file key and dynamic product routes). Do not treat the current static editor as a full multi-product catalogue.
- Product-specific fields start blank deliberately; no product category or unsupported claims are assumed. Do not publish until real product details and actual deliverables are entered.

## 1. Configure the real product

Use `/admin.html` to edit storefront content and export `store-config.json`. Replace that file and redeploy to publish changes:

- `brand`, `email`, `maker.name`, `maker.line`, `legal`, and optional `whatsapp`.
- `price`, `value`, `productId`, and `productName`.
- `pixelId` if Meta tracking is being used; replace `YOUR_PIXEL_ID` with the actual numeric Pixel ID.

Make the same Pixel ID and support email changes in `thank-you.html`.

The real charge amount is controlled by `PRODUCT_PRICE_INR` in Cloudflare settings. Keep it consistent with `store-config.json` price. The server amount is authoritative. Do not put API keys or tokens in HTML.

Edit the page copy so the stated product counts, formats, refund details, file list, update terms, and turnaround are accurate. If you have a real cover, replace `assets/cover.svg` (or change the image path) with a licensed image around **1200 × 900 px, 4:3 landscape**. Update Open Graph/social preview metadata if you add a separate social image.

## 2. Create the private download file

Package the actual product into a ZIP, for example `eboora-product-download.zip`. It may include a PDF, start-here instructions, licensed assets, and the real Canva/Notion links. Do not put paid downloadable files in the public site directory.

In Cloudflare R2:

1. Create a bucket that is not exposed through a public URL.
2. Upload the product ZIP using the object key you will configure in `PRODUCT_FILE_KEY` (for example `eboora-product-download.zip`).
3. Bind this bucket to the Pages project with the binding name **`PRODUCTS_BUCKET`**.

The download endpoint streams the file from R2 only after validating the signed URL, a D1 order record, and Cashfree's current `PAID` order status. This protects the file from being a public static asset. Keep the R2 bucket private.

## 3. Create D1 and initialize the schema

1. Create a Cloudflare D1 database.
2. Run `schema.sql` once using the D1 Console or Wrangler.
3. Bind it to your Pages project with the binding name **`ORDERS_DB`**.
4. Redeploy after changing bindings.

The D1 table stores the order ID, product/amount/currency, buyer contact details needed for order support and delivery, payment status, and delivery/Meta processing status. Restrict dashboard access to people who need it and follow your retention policy.

## 4. Add Cloudflare variables and secrets

Set these under **Workers & Pages → your Pages project → Settings → Variables and Secrets**. Add them for both preview and production as appropriate, then redeploy. Store API credentials and tokens as **Secrets**, not as source code or public variables.

| Name | Type | Required | Purpose |
|---|---|---:|---|
| `SITE_URL` | Variable | Yes | Canonical HTTPS origin, e.g. `https://shop.example.in`, no trailing slash |
| `CASHFREE_ENV` | Variable | Yes | `sandbox` for testing, `production` only after successful tests |
| `CASHFREE_APP_ID` | Secret | Yes | Cashfree App ID matching the selected environment |
| `CASHFREE_SECRET_KEY` | Secret | Yes | Cashfree API secret matching the selected environment |
| `CASHFREE_WEBHOOK_SECRET` | Secret | Recommended | Webhook signing secret configured in Cashfree; if Cashfree uses the same key, it may be the same value as `CASHFREE_SECRET_KEY` |
| `CASHFREE_API_VERSION` | Variable | No | Defaults to `2026-01-01`; change only after testing the API migration |
| `PRODUCT_PRICE_INR` | Variable | Yes | Numeric price to charge, e.g. `499` |
| `PRODUCT_CURRENCY` | Variable | No | Defaults to `INR` |
| `PRODUCT_ID` | Variable | Yes | Stable ID matching the page config, e.g. `eboora-product` |
| `PRODUCT_NAME` | Variable | Yes | Product name used in order/email text |
| `PRODUCT_FILENAME` | Variable | No | Download filename shown to the buyer; default `eboora-product-download.zip` |
| `PRODUCT_FILE_KEY` | Variable | Yes | Exact private R2 object key, e.g. `eboora-product-download.zip` |
| `DOWNLOAD_TOKEN_SECRET` | Secret | Yes | Random secret at least 32 characters; used to sign download URLs |
| `RESEND_API_KEY` | Secret | Yes | Resend API key for transactional download emails |
| `FROM_EMAIL` | Variable | Yes | Verified sender, e.g. `the configured digital product <downloads@example.in>` |
| `REPLY_TO` | Variable | No | Support email address |
| `BRAND_NAME` | Variable | No | Brand used in email footer |
| `META_PIXEL_ID` | Variable | Optional | Same numeric Pixel ID as `store-config.json` `pixelId` |
| `META_CAPI_TOKEN` | Secret | Optional | Meta Conversions API access token |
| `META_TEST_CODE` | Variable | Testing only | Test Events code from Meta Events Manager; remove/clear after testing |

Generate a strong random `DOWNLOAD_TOKEN_SECRET` and do not reuse your Cashfree or Meta credentials for it. Do not commit actual secrets to Git.

## 5. Configure Cashfree

1. Start with Cashfree sandbox credentials and `CASHFREE_ENV=sandbox`.
2. In Cashfree, configure a payment-success webhook to:
   `https://YOUR_DOMAIN/api/cashfree-webhook`
3. Subscribe to the payment-success event (`PAYMENT_SUCCESS_WEBHOOK`). Set `CASHFREE_WEBHOOK_SECRET` to the signing secret configured in Cashfree. If your Cashfree account uses the API secret for webhook signing, it may match `CASHFREE_SECRET_KEY`.
4. Ensure the Cashfree application is approved for your intended live use before switching to production credentials.
5. After sandbox testing passes, switch `CASHFREE_ENV` to `production` and set matching production App ID/Secret. Never mix sandbox credentials with production mode or vice versa.

The browser uses Cashfree's hosted checkout SDK. The server creates each order and returns only a payment session ID; the browser-supplied amount is never trusted for charging. The thank-you page calls `/api/verify-order`, which queries Cashfree directly. The webhook is separately signature-verified and updates the local order state.

## 6. Configure transactional email

Create a Resend account, verify the domain/sender used in `FROM_EMAIL`, set `RESEND_API_KEY`, and set `REPLY_TO` to a real support inbox. The webhook sends the download email with an idempotency key so a retried webhook does not intentionally send repeated copies. Test actual inbox delivery and spam placement in sandbox before launch.

## 7. Configure Meta tracking (optional)

- Set `pixelId` in `store-config.json` to your real Pixel ID.
- In Cloudflare, set `META_PIXEL_ID` and `META_CAPI_TOKEN` for server-side Purchase events.
- Use `META_TEST_CODE` only while testing, then remove it.
- Browser Purchase is sent only after `/api/verify-order` confirms `PAID`; server Purchase is emitted by the signed Cashfree webhook. Both use the Cashfree order ID as the event ID for deduplication.
- The server code targets Graph API `v26.0` (current as of 29 October 2026). Re-check Meta's changelog before future launches or upgrades.

The privacy page discloses Meta tracking but is a template; update it to reflect what you actually enable and review whether a consent mechanism is required for your audience/jurisdictions.

## 8. Deploy to Cloudflare Pages

You can connect the project folder to a Git repository and choose it as the Cloudflare Pages project, or deploy with Wrangler. Make sure the Pages output directory is the repository root (`.`) for this file layout, and that Cloudflare includes the `functions/` directory in the deployment. Change the project name in `wrangler.toml` or the deploy command to your own project name.

Example Wrangler deployment from this directory:

```bash
npx wrangler pages deploy . --project-name YOUR_PAGES_PROJECT
```

Add the D1/R2 bindings and variables in the Cloudflare dashboard and redeploy after binding/configuration changes. Use HTTPS and set `SITE_URL` to the final custom domain before testing return URLs and webhooks.

## 9. Run local code checks

With Node.js 22 or later, run:

```bash
npm run check
```

This checks backend JavaScript syntax, helper validation/token behavior, and a mocked checkout → webhook → verified download flow. It does not replace a real Cashfree sandbox transaction or real Cloudflare binding test.

## 10. Sandbox launch checklist

Do not switch to production until these all pass:

- [ ] No `Eboora-Store`, `[business address]`, `yourdomain.com`, `YOUR_PIXEL_ID`, placeholder copy, or unused `₹499` values remain unless they are truly correct.
- [ ] The product page promises only content actually included in the R2 ZIP and any connected Canva/Notion resources.
- [ ] Privacy, Terms and Refund pages match the real seller, product, support practices and applicable law.
- [ ] All buy buttons open the customer detail dialog on desktop and mobile.
- [ ] Valid customer information creates a sandbox Cashfree order at the server-configured amount.
- [ ] Invalid name/email/mobile are rejected; the browser cannot alter the actual server charge amount.
- [ ] Successful sandbox payment returns to `/thank-you.html?order_id=...`.
- [ ] The thank-you page shows the download only after the server confirms the Cashfree order is `PAID`.
- [ ] The downloaded file is the private R2 product file, and an invalid order ID/token cannot download it.
- [ ] A non-paid/unknown order cannot access the private download.
- [ ] Cashfree webhook rejects invalid signatures and updates a real paid order.
- [ ] The buyer receives the download email from the verified sender; replies go to the real support address.
- [ ] Meta Test Events show the expected PageView/ViewContent/InitiateCheckout/Purchase events and browser/server Purchase is deduplicated. If Meta tracking is not configured, confirm the purchase flow still works without it.
- [ ] Check the full layout at 320px, 360px, 390px, tablet, and desktop widths; test keyboard focus, dialog close, labels and reduced-motion settings.
- [ ] Make a backup and confirm you can view order records and respond to a failed delivery.

## Design research notes

The refinements apply common digital-product storefront practices: lead with the result the buyer wants, keep the hero value proposition compact, show what the buyer receives, provide sample previews, explain the purchase-to-delivery path, keep the CTA visible on small screens, and avoid unverifiable testimonials. Product setup/delivery patterns were cross-checked against official [Payhip digital product guidance](https://help.payhip.com/article/59-adding-a-digital-product), [Stan Store digital download guidance](https://help.stan.store/article/14-sell-a-digital-download-product), and [Lemon Squeezy product setup](https://docs.lemonsqueezy.com/help/products/adding-products). Cashfree's official developer flow uses server-side order creation and a payment session for the JS checkout, followed by order-status verification; see [Cashfree Checkout - Web](https://www.cashfree.com/devstudio/preview/pg/web/checkout). These are inspiration and technical references, not copied layouts.
