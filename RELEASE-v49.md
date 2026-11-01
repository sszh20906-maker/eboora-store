# Eboora V49 — Responsive Live Product Preview

## Changes
- Replaced the separate-tab preview action with an in-admin preview workspace.
- Added Desktop, Tablet and Mobile viewport controls.
- Added live editor-to-preview updates for product copy, pricing, theme, colours, typography, benefits, included items, FAQs, reviews and creator details.
- Preview remains a draft: changes are stored in browser localStorage for preview and are not published until the product is saved through the existing save flow.
- Added accessible close controls, Escape handling and modal backdrop close.
- Added same-origin and preview-mode checks before accepting live preview messages.

## Verification
- `node --check public/admin.js` passed.
- `node --check public/landing.js` passed.
- `npm run check` passed (existing test suite).
- Cloudflare deployment and physical-device visual testing have not been performed in this environment.
