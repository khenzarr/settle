# Marketplace API boundary

Settle exposes a grant-safe, API-first boundary for a marketplace to plan
canonical USDC settlement terms and read existing public-chain orders. This
is not a production merchant execution API: no route creates an order, signs
a transaction, calls Circle, or mutates the chain.

## Plan an order

`POST /api/v1/orders/plan` is deterministic and non-mutating.

```json
{
  "externalOrderId": "DD-928310",
  "buyer": "0x1111111111111111111111111111111111111111",
  "amountUsdc": "42.50",
  "fundingDeadline": "2030-01-01T12:00:00Z",
  "settlementDeadline": "2030-01-08T12:00:00Z",
  "settlement": [
    { "recipient": "0x2222222222222222222222222222222222222222", "shareBps": 8200 },
    { "recipient": "0x3333333333333333333333333333333333333333", "shareBps": 800 },
    { "recipient": "0x4444444444444444444444444444444444444444", "shareBps": 1000 }
  ]
}
```

The response has `mode: "plan"`, `executionAvailable: false`, the canonical
nonzero `orderId`, exact USDC base units, canonical `termsHash`, splits, and
public Arc Testnet network configuration. It says **Order plan prepared**;
it never says order created and returns no calldata, ABI, wallet, credential,
or idempotency data.

`externalOrderId` is a bounded printable business reference (1–128
characters). It is not the contract `orderId` and is not committed onchain.
The canonical identity and terms hash are derived from normalized buyer,
amount, deadlines, and settlement splits using the shared deterministic
settlement representation. Equivalent normalized requests produce equivalent
identities; no clock, randomness, or browser custody identity is involved.

Unknown fields are rejected, including execution controls (`target`, `contract`,
`calldata`, `function`, `execute`, `retry`), credentials, wallet IDs,
idempotency keys, and role claims.

Amounts are exact six-decimal USDC strings: no exponent notation, negatives,
zero, floating-point arithmetic, or more than six fractional digits. Splits
contain 1–8 unique nonzero addresses, positive integer `shareBps`, totaling
exactly 10,000. Payouts use integer math and the final-recipient remainder.

## Read an existing order

`GET /api/v1/orders/:orderId` is read-only and returns the canonical order
projection plus marketplace actions and evidence. Canonical chain state is
authoritative. If evidence is unavailable, the order is still returned with a
bounded partial/unavailable evidence warning; evidence failure is never
reported as a missing order and no payout history is fabricated.

The view includes `orderId`, lifecycle `status` and `statusLabel`, buyer,
amount, funding/settlement deadlines, escrow state, settlement recipients and
expected payouts, customer/public/marketplace/arbitration action projections,
and evidence completeness/lifecycle/payouts/warnings.

Actions distinguish protocol capability from deployment capability. For
example, a funded order can expose marketplace release/refund as
`protocolAvailable: true` while `executionAvailable: false`; operator and
arbitrator actions are not browser-executable. Created orders expose buyer
approve/fund before the funding deadline and public cancellation at the exact
`now >= fundingDeadline` boundary. Funded orders expose dispute only to the
stored buyer. Disputed orders require arbitration. Completed, refunded, and
cancelled orders are terminal; cancellation is distinct from refund.

## Delivery marketplace example

A DoorDash-like food-delivery marketplace could plan a 42.50 USDC order with
restaurant 82%, courier 8%, and platform 10%, then retain the returned
`orderId` and `termsHash`. A future create/payment-intent step would connect
that plan to hosted checkout or a QR payload; the customer would fund escrow;
the marketplace would read this endpoint (and eventually receive webhooks) to
observe `Funded`, then continue its settlement workflow. DoorDash does not
currently integrate with Settle.

## Roadmap and errors

The future production `POST /v1/orders` will require marketplace
authentication, authorization, durable idempotency, and operator execution
infrastructure. Hosted checkout and QR/POS are future clients of these same
shared plan/view primitives. Current errors are bounded: planning returns
`invalid-request`, `invalid-external-order-id`, `invalid-buyer`,
`invalid-amount`, `invalid-deadline`, `invalid-settlement`, or
`unsupported-input`; reads return `invalid-order-id`, `unknown-order`,
`wrong-chain`, `rpc-unavailable`, or `malformed-chain-data`.
