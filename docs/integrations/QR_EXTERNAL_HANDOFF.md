# QR and External Payment Handoff

Settle exposes a read-only handoff for an existing canonical Payment Intent:

```http
GET /api/v1/payment-intents/<orderId>/handoff
```

Configure `SETTLE_PUBLIC_APP_ORIGIN` as the trusted, root-only HTTPS application origin, for example `https://settle.example`. Development may use explicit loopback HTTP such as `http://localhost:3000`. Settle never derives this origin from request or forwarded headers.

The response projects the canonical order state and one navigation payload: `https://settle.example/pay/<orderId>`. `checkout.url`, `deeplink.url`, and `qr.payload` are identical. The QR contains no USDC transfer, recipient, calldata, transaction, or wallet session. Scanning opens the same hosted checkout, where exact approval and `fundOrder(orderId)` remain authoritative.

`handoff.available` means the canonical status page can be opened. `handoff.paymentActionAvailable` is true only for an unexpired `Created` order. Expired, Funded, Disputed, Completed, Refunded, and Cancelled orders remain viewable but are not presented as payable. A marketplace plan has `handoff.available: false` with `marketplace-create-required`; it does not receive an absolute URL or QR before the onchain order exists.

## Commerce Flows

**Food delivery:** After a marketplace's 42.50 USDC canonical Settle order exists, its backend reads the handoff. The driver or customer app displays the returned QR, the customer scans it, and hosted checkout performs wallet approval and escrow funding.

**POS:** A merchant terminal displays the canonical handoff QR. The customer scans it and opens Settle checkout. Settlement continues to follow the contract's configured splits.

**Desktop to mobile:** Desktop checkout displays the QR. A customer scans with a mobile device containing their wallet. Both devices refer to the same order ID and canonical payment state; wrong-wallet protection remains in hosted checkout.

Evidence links are optional presentation data. Evidence degradation does not disable handoff or change canonical state. No polling framework, persistent QR session, Circle mutation, or blockchain write is introduced.

A future authenticated `POST /v1/orders` can create the canonical order and then return this same checkout and QR-ready URL. This handoff API does not implement order creation.