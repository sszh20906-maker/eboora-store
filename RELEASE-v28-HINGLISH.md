# Eboora v28 — changes and limitations

- R2 ke bina **350 KB tak** JPG/PNG/WebP cover upload directly admin se ho sakta hai. Cover D1 `store_settings` mein save hota hai, koi extra table ya credit card nahi. Image compress karke upload karo. D1 free-plan write/read limits apply.
- Product PDF/ZIP/large files ke liye existing Google Drive sharing link delivery use karo. Public Google Drive links buyer aage share kar sakte hain; user ne resale/share allow kiya hai. Ye DRM nahi hai.
- Product delete dialog: safe archive default, optional double-confirmed **PERMANENT DELETE** even with previous orders. CAUTION: old paid buyers ke download links break ho sakte hain. Order accounting records remain.
- Existing admin sidebar, product preview, sales chart, four themes, responsive storefront retained.
- Copy selection 2–3 second hold enforce nahi kiya: mobile browser/OS text selection ko reliable tarike se control nahi kiya ja sakta. CSS disable karna accessibility aur buyer UX ko hurt karega.
- No D1 migration required: existing `store_settings` and `products` tables must already exist.
- `npm run check` includes existing mocked payment/security/product tests plus D1 image-delivery regression. This is **not** a production Cashfree or real-device test. Preview deployment + test purchase before pushing production.
- Existing Cashfree keys, `wrangler.toml`, D1 bindings, Git repo ko replace mat karna.
