# Eboora V55 — Store Settings, SEO & Tracking

## Added
- Owner-authenticated `/api/admin/site-settings` GET/PUT endpoint storing settings in the existing `store_settings` D1 table (no schema migration).
- Store name, tagline, HTTPS logo URL and public support email settings.
- SEO title, SEO description and social-sharing image metadata.
- Instagram, YouTube, Facebook and X profile URLs, plus optional external policy URLs.
- Optional Meta Pixel and Google Analytics 4 Measurement ID configuration.
- Public `/api/site-settings` endpoint exposes only validated public fields; no admin/session/payment data is returned.
- Public landing page applies SEO metadata and configured branding; analytics scripts load only when valid IDs are configured.

## Validation
- All settings are length-limited and HTTPS URLs are validated.
- Social URLs are restricted to their expected hostnames.
- GA ID must match `G-...`; Meta Pixel ID must be 5–20 digits.
- No secrets are stored or exposed. Analytics remain optional and should be configured only with appropriate privacy disclosures/consent for applicable visitors.

## Deployment
No D1 migration required. Existing `store_settings` table is reused.
