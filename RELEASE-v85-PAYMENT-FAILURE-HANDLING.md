# V85 — Payment failure status handling

- Normalizes Cashfree payment-attempt API responses whether returned as an array or an object containing `payments`/`data`.
- Uses the newest payment attempt when deciding whether to show FAILED, USER_DROPPED, or continue showing PENDING. Older failed attempts no longer mask a newer in-progress retry.
- Shows Cashfree's failure detail when available, with a safe fallback message.
- Preserves the key safety rule: a failed attempt does not mark the entire order failed, because the customer may retry and subsequently pay successfully.
- Successful payment verification and download gating remain unchanged.

Run `npm run check` before deployment. Real Cashfree failure scenarios still need a sandbox test using the merchant's configured webhook events and credentials.
