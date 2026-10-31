# Eboora V45 — Commerce UI and management update

- Shop: rebuilt editorial homepage UI, live search and sorting, conversion-focused trust blocks, matching mobile layout.
- Admin: consistent cyan/navy dashboard styling and independent Homepage Video settings page.
- Product/detail, checkout, Thank You, and policy pages share V45 design tokens.
- Order removal: permanent removal of paid/unpaid/failed/cancelled orders; minimal financial audit and payment receipts retained. **WARNING:** deleting paid orders removes the purchase record used by download verification. Do not delete an order if the buyer still needs their download. Cashfree refunds are separate.
- Exports: owner-only CSV, available for all status filters.
- Videos: YouTube player is loaded only when visitor clicks Play; external hosting, no video file storage.
- Text styling: existing product headline and description font family, size, and color controls preserved.
- No new JS frameworks or libraries. No D1 migration needed; new storefront setting uses existing store_settings table and audit table auto-creates on deletion.
- Production integration should be verified on Cloudflare (order deletion, payment, admin authentication and mobile browsing) before treating as fully production-tested.
