# Eboora v30 — cover + typography + storage cleanup

- Product landing hero cover now 16:9 (recommended 1280 x 720), object-fit contain, no crop.
- Mobile/desktop hero headings and body text reduced.
- Removing a D1 cover clears its `store_settings` record after product update succeeds.
- Replacing a D1 cover with an R2 cover clears the old D1 blob.
- Replacing a D1 cover with another D1 cover overwrites the same setting key.
- Replacing an R2 cover deletes the old object (best-effort).
- No D1 schema migration required.
- Important: an external cover URL is not a hosted D1 file and cannot be deleted from third-party hosting.
- Live Cloudflare deployment and real-device testing still required.
