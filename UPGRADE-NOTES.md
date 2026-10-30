# Eboora visual refresh — 30 Oct 2026

This source was inspected against the uploaded v25 ZIP.

Changes in this revision:
- More polished, responsive admin sidebar and distinct workspace heading.
- Search and status filter for admin products, cover thumbnails and clearer delete action.
- Prevent creating an unintended product if Upload clicked before choosing a file.
- Polished two-column mobile product catalogue, stronger hero, focused CTA.
- Existing backend, checkout, D1 schema, authentication, verified download logic preserved.

Already present in uploaded v25: overview revenue chart, separate admin tabs, draft preview, image URL, Drive delivery, multiple product themes, delete/archive logic.

IMPORTANT: No R2 means direct local file upload cannot work. Use cover static URL or external image link; use Google Drive for product delivery. Drive Anyone-with-link access is shareable. Historical orders still require archived product rows for buyer access.

No SQL migration needed for this visual refresh. Do NOT run schema.sql blindly on production.

After deploying, test authentication, create/edit/delete in staging, Cashfree sandbox checkout and delivery first. Clear browser cache if old CSS appears.
