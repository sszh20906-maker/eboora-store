# Eboora V54 — Product & Order Management

## Changes
- Added debounced order search across order ID, customer name, email address, and phone number, while preserving the selected payment-status filter.
- Increased the admin order-list result window from 200 to 500 to make management/search more useful without introducing pagination assumptions into the current UI.
- Preserved product search and status filtering, product draft/published controls, existing product editor, order bulk deletion, and filtered CSV export.
- Kept all order endpoints behind the existing admin authentication requirement.

## Validation
- `npm run check` includes a V54 regression test for the search controls, query fields, bulk deletion, and CSV export.
- Search is limited to 100 characters and uses bound SQL parameters.
- Production D1 data, deployment, and Android visual behaviour require deployment-side verification.
