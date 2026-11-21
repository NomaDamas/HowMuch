# QR pairing contract

QR pairing connects a phone camera client to a localhost HowMuch session without embedding secrets.

1. Host creates a short-lived session: `POST /v1/pairing/sessions` → `{sessionId, token, expiresAt}`.
2. Host renders a QR containing `howmuch://pair?session=<id>&token=<single-use-token>`.
3. Phone scans, confirms the displayed host origin, and exchanges the token once: `POST /v1/pairing/exchange`.
4. Server returns an ephemeral client token scoped to the session; it expires after 10 minutes or explicit revoke.
5. Research images and results travel over the existing `/api/research` contract. Provider secrets never enter the QR or phone.

Implementations must use HTTPS outside localhost, single-use tokens, origin confirmation, expiry, revoke, and no raw camera-frame persistence.
