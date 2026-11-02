# Eboora V84 — Responsive viewport and horizontal overflow fix

## Root cause
The conversion landing-page hero background used a pseudo-element with `inset: 0 -100vw`. On mobile/desktop-site viewport configurations this expanded the document's horizontal layout area beyond the visible screen. Browsers then displayed a zoomed-out page with the actual content confined to the left and a large blank area to the right.

## Changes
- Constrained the landing/product-page document to the viewport without hiding the page's intended content.
- Kept the `.lp-wrap` centered and full available width up to 1160px.
- Confined the hero background pseudo-element to its section instead of extending it by negative viewport-width insets.
- Preserved the full-width mobile header while matching its negative margins to the mobile wrapper padding.
- Preserved the existing V81 checkout and V83 contrast fixes.
- Added a responsive-layout regression test and included it in `npm run check`.

## Scope
Presentation-only changes in the landing/product-page CSS and stylesheet references. No checkout, Cashfree, order, webhook, D1, authentication, email, coupon, or download implementation was changed.

## Verification
- Browser layout checks at 320, 360, 390, 430, 600, 690, 768, 820, 821, 1024, 1280, 1365, and 1920 CSS-pixel viewport widths.
- Verified document scroll width does not exceed viewport width at any tested width.
- Verified wrapper width and full-width mobile/tablet header sizing.
- Full automated regression suite run separately; production settings/payment delivery still require the owner's live environment verification.
