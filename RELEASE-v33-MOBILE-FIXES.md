# Eboora v33 mobile fixes
- Admin inputs forced to readable light appearance even when Android dark mode is on.
- Admin Product Studio has headline font family, desktop size and text color, persisted per product in D1 JSON.
- Mobile headline scales down with viewport; long words wrap.
- 16:9 contain for product images; no cropping.
- Mobile catalog card navigates directly to product page; desktop quick view retained.
- IMPORTANT: If uploaded artwork itself contains JUST ₹199 while price is ₹299, that text is embedded in the image. Replace/re-export the cover with no hard-coded price, or correct it to match actual product price. Code cannot safely edit text baked into a raster image. Checkout still uses backend price.
