# Settle Payment Intent and Hosted Checkout

## Meaning and identity

A Payment Intent is Settle's publication-safe commerce projection of one
canonical Settle order: buyer, exact USDC amount, deadlines, payment state,
checkout availability, and settlement lifecycle. In this grant-safe phase its
canonical identity is `orderId`; no separately persisted Payment Intent exists.
There is no random ID, UUID, or ephemeral durable-object claim. A future
durable API may add a merchant-facing Payment Intent ID if required.

## Planned versus onchain

`POST /api/v1/orders/plan` remains the single planning request. It returns the
existing deterministic order plan plus `paymentIntent.source = "plan"`, the
same `orderId`, `paymentState = "planned"`, and an unavailable checkout with
reason `marketplace-create-required`. Planning is non-mutating: marketplace
creation is still required, so the plan must never appear payable.

After a canonical onchain order exists, `GET /api/v1/payment-intents/<orderId>`
returns `source = "onchain"`. A canonical Created order before its funding
deadline is `awaiting-payment` and has `/pay/<orderId>` available. An onchain
view does not fabricate `externalOrderId`: the contract does not persist that
marketplace reference and there is no database to recover it from.

## State mapping

| Canonical contract status | Payment state | Customer meaning |
|---|---|---|
| None (planned projection) | planned | Marketplace creation is still required |
| Created before deadline | awaiting-payment | Customer may pay |
| Created at/after deadline | payment-window-expired | Payment is suppressed; canonical status remains Created |
| Funded | funded | USDC is held in escrow, not merchant-paid |
| Disputed | disputed | Funds remain held; arbitrator resolution is required |
| Completed | completed | Terminal settlement state |
| Refunded | refunded | Full escrowed amount returned to the buyer |
| Cancelled | cancelled | Unfunded cancellation; this is not a refund |

The funding deadline is separate from the settlement deadline. The latter
never creates an automatic payment action.

## Hosted checkout and authorization

The public customer route is `/pay/<orderId>`. It is deliberately relative;
Settle does not derive an absolute URL from Host, forwarded headers, or browser
origin. The route parameter supplies only `orderId`; amount, buyer, network,
token, contract, status, and transaction data come from canonical reads.

The page reuses the existing buyer wallet adapter, exact buyer transaction
intent service, allowance comparison, operation progress, recovery storage,
transaction confirmation, and role-aware action state. The customer sees
“Approve” only when allowance is below the exact amount. Approval is exact—no
unlimited approval. When allowance is sufficient, approval is skipped and the
primary action is “Pay”; implementation uses the validated `fundOrder(orderId)`
intent. Direct USDC transfers to a merchant, operator, or escrow address are
not payment paths.

Only the canonical stored buyer may approve or fund. A different connected
wallet sees “This checkout is assigned to another wallet” and cannot submit.
Network switching uses the existing Arc Testnet adapter (`5042002`). Hash and
receipt are intermediate evidence; only a subsequent canonical state read
confirms payment. Reload recovery is order/operation isolated and never
automatically retries or submits a replacement transaction.

## Lifecycle and degraded evidence

Funded shows “Payment funded” and “USDC is held in escrow.” Disputed shows the
active dispute and arbitrator requirement, with no second payment. Completed
is the terminal settlement state and may include bounded ArcScan evidence.
Refunded communicates the full buyer refund. Cancelled communicates unfunded
cancellation. If lifecycle evidence is unavailable, checkout still renders
the canonical status and shows a bounded evidence warning; canonical failure
alone makes the order unavailable.

## Marketplace relationship and future API

Current grant-safe flow:

```text
POST /api/v1/orders/plan
  -> planned order + planned Payment Intent
  -> marketplace create required
  -> canonical onchain order
  -> GET Payment Intent / hosted checkout
```

Future production flow (not implemented here) is an authenticated
`POST /v1/orders` that creates the canonical order, returns its Payment Intent
and checkout path, then lets the marketplace observe Funded via GET or a
future webhook. There is currently no merchant auth, database, persistence,
operator execution, or server-side creation endpoint.

## D4C4 QR contract

D4C3 intentionally does not render or encode QR. D4C4 should combine an
explicitly configured public Settle origin with `/pay/<orderId>` and encode
that hosted checkout URL. It must not encode a raw USDC transfer to escrow,
because that bypasses `fundOrder` and escrow accounting.

## Food-delivery example

A food marketplace can plan `delivery-928310` for `42.50 USDC` and its buyer
wallet. The plan is not payable until the marketplace's separate canonical
create workflow completes. Once Created on Arc Testnet, the customer opens
`/pay/<orderId>`, connects the assigned wallet, approves only if needed, and
presses “Pay.” The marketplace can later read `funded` without understanding
ABI calldata, BPS payout arithmetic, or Arc RPC mechanics. This is an
illustrative integration pattern, not a claim of integration with any named
delivery company.