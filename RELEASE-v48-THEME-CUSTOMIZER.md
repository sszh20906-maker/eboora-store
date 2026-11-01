# Eboora V48 — Public Theme Engine

## Changes
- Applies the selected product theme palette to the actual public product landing page.
- Adds theme tokens for accent, headline, body text, page background, cards, buttons and button text.
- Existing custom accent, headline and description colour settings override the selected preset where configured.
- Adds editable HEX text fields beside the existing accent/headline/body colour pickers in the admin product editor; valid HEX values sync with the native picker and persist through the existing product settings API.
- Updates the admin live preview to reflect the chosen accent, headline and body text colours.
- Bumps the V48 stylesheet cache key.

## Validation
- `npm run check` passed all repository checks. Test output includes expected mocked D1 missing-table diagnostics and a simulated owner-alert email failure; the corresponding regression suites still passed.
- `node --check public/landing.js` and `node --check public/admin.js` passed as part of the check script.

## Notes
This release does not claim a live Cloudflare deployment or real-device visual test. Deploy to a staging/production Pages environment and verify a saved product on Android before treating the visual QA as complete.
