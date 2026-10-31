# Eboora V44 — UI and commerce update

- DiziProducts/VaultWorld cyan/navy reference palette adapted to existing static HTML/CSS architecture.
- Redesigned storefront, product and admin surfaces, consistent confirmation and informational pages.
- Front-page video uses the first published product with a configured YouTube URL; playback iframe loads only after click.
- Admin allows removing paid and unpaid orders individually or in batches by archiving them in `admin_hidden_orders`. This is intentional: financial, receipt, download, and Cashfree verification records remain intact. No database migration required; table created on first use.
- Order CSV export now supports paid or unpaid statuses, up to 5000 matching orders.
- Description text font, color and size customization.
- No Next.js/Firebase/React migration and no bundled videos.
- Test payment/webhook flows on Sandbox before deploying live.
