# Eboora v27 — verified source patch

Based on the user-provided v26 ZIP. This release retains the existing separate admin sections, chart, Google Drive paid redirect, four themes, preview, D1 product management and Cashfree endpoints.

New in this patch:
- Unsaved JPG/PNG/WebP cover (max 2 MB) can be displayed on product Preview without R2. This is preview ONLY, not a hosted upload.
- Clearer editor warning about cover files and R2 limitations.
- Product catalogue falls back to bundled cover when a remote image is broken.
- Added regression checks for preview wiring and cover fallback.

`npm run check` passed in this environment. Mocked payment tests are NOT a substitute for Cashfree sandbox/live verification, browser screenshots, D1 production checks or deployment validation.

Still not provided: credit-card-free permanent private file storage, automatic Google Drive file protection, permanent deletion of products with historical orders, browser-enforced long-press copy gesture. No D1 migration was added. Do not run schema.sql on production without inspecting it.

Deploy first to a Cloudflare preview branch and test checkout/delivery before updating production.
