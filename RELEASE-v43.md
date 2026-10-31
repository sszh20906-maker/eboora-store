# Eboora V43 — UI and Commerce Controls

- Updated thank-you experience, storefront focus/accessibility and admin readability.
- Product editor: eight headline font choices and an optional YouTube product-video URL. The video is embedded only after the visitor clicks Play; video bytes remain on YouTube, not D1/Pages.
- Admin: CSV export of CREATED/FAILED/CANCELLED orders (up to 5,000 rows per export), with customer contact fields. Keep exported files private; only contact customers with appropriate consent.
- Admin: permanent delete for CREATED/FAILED/CANCELLED orders only, with confirmation and server-side restrictions. Paid orders and orders with financial receipts/refunds are protected. No database migration is required beyond existing v32 `payment_receipts` table.
- Payment, authentication and digital delivery implementations otherwise retained.
- Test on Android and in Cashfree Sandbox before enabling live payments.
