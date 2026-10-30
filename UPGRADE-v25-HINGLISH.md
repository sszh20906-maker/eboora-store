# Eboora v25 · Existing Cloudflare Pages upgrade

## Deployment (Termux)
1. Zip ka folder existing Cloudflare Pages project ke source se replace/update karo; **new project mat banao**. Git deploy use kar rahe ho to updated repo push karo. Wrangler Direct Upload use karte ho to existing project ko deploy karo, matching Pages project name confirm karo.
2. Termux commands (folder ke andar):
   `pkg install nodejs unzip -y`
   `npm run check`
   `npx wrangler login` (if needed)
   `npx wrangler pages deploy public --project-name <YOUR_EXISTING_PAGES_PROJECT>`
   NOTE: Wrangler Direct Upload for Pages Functions compatibility may vary: if upload says Functions are not deployed, use your Git integration or Wrangler version supporting functions. Confirm `/api/admin/products` after deployment.
3. **No SQL migration needed** for this release: `products.data` is existing JSON, and deliveryUrl/theme are stored within it. Existing DB binding must remain `ORDERS_DB`. For missing products table only, Cloudflare D1 Console: 
   `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')), data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));`
4. Backup before deploying: Cloudflare D1 dashboard Export or `npx wrangler d1 export eboora-orders --remote --output=backup-before-v25.sql` if using the bound account. NEVER run `schema.sql` against a live DB with unknown state without confirming backup.
5. No secrets/keys are changed. Retain Cashfree, mail, Admin secret and D1 bindings.

## Features
- Admin left navigation Overview / Orders / Products / Coupons + separate editor. Revenue chart from real D1 orders (last 14 UTC days) rather than fake chart.
- Live preview before first save.
- Seller may paste a Google Drive share link in `Product delivery`. Buyer receives it through signed URL ONLY after server re-checks payment. Google Drive `Anyone with the link → Viewer` is necessary; buyer may forward the link freely. No file entitlement / DRM is possible using public Google Drive sharing. Do NOT sell sensitive/licensed confidential material via this approach.
- Cover link: paste an HTTPS direct image URL in Cover image path. For hosting without R2 you can place a cover image under `public/assets/` in the source project then set `/assets/your-cover.webp`; this requires redeploy. Avoid Google Drive share-page URLs as img source (not direct images). The optional R2 upload remains but is not required for new Google Drive products.
- For products with historical orders, Delete archives the product, **not permanent deletion**, to preserve fulfilment and payment auditability. For products without orders Delete removes D1 row. This is intentional protection. Archived entries remain in admin. Full erasure of sale-linked product requires a separate retention/fulfilment strategy and is not enabled here.
- Live theme selector: midnight blue / forest green / royal violet / sunset amber. Price/discount claims and testimonials must be genuine.

## Smoke tests
- Open existing admin URL, log in and check overview + tabs; create draft; check preview; set public cover image URL and Drive folder link; save and publish.
- Place one Cashfree sandbox order and verify PAID, then check thank-you download redirects to Drive. Failed/unpaid orders must NOT get link. Test resends and refunds separately.
- Do NOT use real purchases until sandbox checkout and email are confirmed. The included unit tests are not a substitute for real Cloudflare binding / Cashfree tests.

## Rollback
Keep old zip and D1 backup. If v25 fails, redeploy v24 using the exact existing Pages project; no DB schema changes were made.
