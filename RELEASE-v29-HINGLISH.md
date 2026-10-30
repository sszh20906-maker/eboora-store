# Eboora v29 — Premium Visual Edition

Based on v28 source. This is a major presentation/UI refresh, not a new checkout backend.

## Changed
- Shared responsive visual system at `public/assets/eboora-premium.css`.
- Premium product catalog: hero, product cards, stronger visual hierarchy, hover/focus and mobile layout.
- Product detail: refined product hero, trust strip, price and CTA, feature cards, checkout dialog and mobile spacing.
- Admin: sidebar, cards, statistics, order/product rows, inputs and responsive navigation restyled.
- All four existing product themes and their underlying behavior retained.
- No D1 schema migration required for the visual changes.

## Verification
- `npm run check`: passed in build environment (mocked payment/security/product suites).
- No production Cloudflare, real Cashfree, or physical Android/Desktop browser session was available. Do not interpret passing tests as proof of live payment success or device-perfect appearance.
- Text copying follows native browser accessibility behavior; long-press-only selection is not guaranteed.
- Product files still use Google Drive links when R2 unavailable; D1 cover upload size limits remain.

## Deployment
1. Back up source and D1 before deploying.
2. Deploy to a Cloudflare Pages preview branch first.
3. Verify storefront, product preview, admin, mobile scrolling, image upload, and Cashfree sandbox checkout.
4. Deploy to main only after successful manual checks.
