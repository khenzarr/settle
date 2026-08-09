# Settle — Final Controlled Demo Runbook

**Design only. Do not execute during evidence-package preparation.** This runbook is for one fresh Arc Testnet order. Demo 002 is excluded permanently.

## Demo story

The evaluator should experience this as **a fictional marketplace adding Pay with USDC through Settle**, not as a tour of an escrow contract lifecycle. Use a simple generic marketplace order and never name or imply integration with a real company.

`marketplace checkout → Settle API / Payment Intent plan → Pay with USDC → hosted checkout / QR → customer wallet → Arc USDC approval if required → fundOrder(orderId) → canonical Funded / escrow → fulfillment decision → controlled settlement → 90/10 payouts → canonical Completed / ArcScan finality`.

Open with the marketplace’s checkout/order context. Close by explaining that the marketplace used Settle’s API-first payment and settlement boundary instead of building wallet handoff, Arc/USDC transaction preparation, escrow, canonical reconciliation, payout splits, and settlement evidence itself.

## Proposed transaction parameters

| Parameter | Recommendation |
|---|---|
| Amount | `0.05 USDC` (`50000` base units): small, readable, already demonstrated |
| Recipients | reviewed merchant test address + controlled platform/operator address |
| Split | merchant `9000 BPS` / platform `1000 BPS` (90/10) |
| Funding deadline | 30 minutes after canonical creation time; confirm at least 20 minutes remain before buyer funding |
| Settlement deadline | 24 hours after funding deadline; it is metadata/guard context, not automation |
| `externalOrderId` | `settle-final-demo-<UTC YYYYMMDDTHHMMSSZ>-<reviewed short nonce>`; never reuse |
| `termsHash` | Keccak-256 of a reviewed canonical UTF-8 JSON terms document with fixed key order, including externalOrderId, Arc chain ID, contract, USDC, buyer, amount, deadlines, recipient addresses/shares, and terms version; retain plaintext privately for reproduction |
| `orderId` | Use the repository’s deterministic planner output for the final reviewed request; compare it byte-for-byte everywhere and confirm `orderExists=false` before create |

Do not invent secrets. Never display or record API key, Entity Secret, private key, recovery material, `.env`, wallet ID, wallet set ID, idempotency key, credential-bearing RPC URL, or terminal history containing them.

## Roles and signing boundary

- Marketplace/planner: constructs and validates the non-mutating plan.
- Controlled Circle operator: signs `createOrder` and `releaseOrder` through the existing CLI process.
- Buyer: connects the exact declared browser wallet, signs exact USDC approval only if needed, then signs `fundOrder(orderId)`.
- `SettlementEscrow`: holds funded USDC and executes recipient transfers.
- Public web/API: checkout and canonical reads; no public operator execution endpoint.

## Universal STOP conditions

Stop immediately; capture state and do not blindly retry if:

- connected wallet differs from the planned buyer;
- chain ID is not `5042002` or network presentation is unexpected;
- any displayed/API/CLI/calldata orderId differs from the reviewed orderId;
- contract target or USDC address differs from canonical values;
- canonical status differs from the expected checkpoint;
- allowance is greater than expected, unknown, or inconsistent with the action UI;
- recipient, share, amount, terms hash, or deadline differs from the frozen plan;
- a Circle or browser transaction submission has an ambiguous result;
- a transaction is pending unusually, receipt is missing, or recovery ownership is unclear;
- an API/evidence panel disagrees with direct canonical state;
- sensitive data would be exposed on screen.

For ambiguity: record the known transaction/Circle reference privately, inspect Circle status and ArcScan/read-only RPC, reconcile nonce/receipt/canonical state, and continue only after a human determines the exact state. Never generate a replacement idempotency key and resubmit merely because UI feedback is delayed.

## PRE-DEMO

### 1. Freeze and sanitize the recording environment

- [ ] Confirm production URL, canonical contract, Arc chain ID, and USDC address.
- [ ] Confirm repository HEAD and that no application code is being changed.
- [ ] Use dedicated Arc Testnet buyer, merchant, and controlled operator addresses.
- [ ] Verify buyer has enough testnet USDC and network fee balance representation; verify operator has adequate fee balance.
- [ ] Close password managers, `.env`, dashboards with IDs, terminal history, notifications, and unrelated tabs.
- [ ] Prepare a clean terminal profile that prints publication-safe summaries only.
- [ ] Prepare ArcScan tabs for contract and address searches; do not prefill a transaction that does not yet exist.
- [ ] Confirm screen recording excludes private Circle console and sensitive terminal regions.

### 2. Build the fresh marketplace plan (non-mutating)

- [ ] Select final buyer and merchant addresses; keep platform recipient `0x4ac8d35f1795531f1e0bef3826db5aab730fcd34` only if operator review confirms it.
- [ ] Create the unique externalOrderId and canonical terms document.
- [ ] Set amount `0.05`, split `9000/1000`, funding deadline +30m, settlement deadline +24h.
- [ ] Call `POST /api/v1/orders/plan` and record the response.
- [ ] Confirm `mode=plan` and `executionAvailable=false`; explain that this is planning, not creation.
- [ ] Independently verify sum of shares = 10,000 and payout math = `0.045` / `0.005`.
- [ ] Freeze the exact orderId, termsHash, participants, deadlines, and request JSON in a private operator record.
- [ ] Read canonical state and confirm `orderExists=false`. **STOP if it exists.**

### 3. Controlled create rehearsal and readiness

- [ ] Run only dry-run/preflight modes for the existing Circle marketplace/operator CLI; inspect target, function, buyer, amount, deadlines, termsHash, recipients, and shares.
- [ ] Confirm controlled operator wallet has `OPERATOR_ROLE` and contract is unpaused using read-only checks.
- [ ] Confirm no public server execution route is enabled or presented.
- [ ] Load production checkout only after creation will exist; before creation, explain that planning does not produce a payable canonical checkout.
- [ ] Perform a no-write camera rehearsal using Demo 002 only for framing; never click or submit any action against it.

## LIVE / RECORDING

### Checkpoint L1 — product and API plan

1. Show a simple fictional marketplace checkout/order context and say: “This marketplace is adding Pay with USDC through Settle.”
2. Show the Settle homepage, then the sanitized `POST /api/v1/orders/plan` request/response as the marketplace integration boundary.
3. Point out amount, buyer, 90/10 split, deadlines, orderId, and `executionAvailable=false`.
4. State: “This validates a Payment Intent plan; it does not create or settle an order.”
5. Present the customer’s **Pay with USDC** choice before moving into controlled order creation.

### Checkpoint L2 — controlled operator create

1. Reconfirm `orderExists=false`, chain `5042002`, canonical target, exact frozen plan, and unpaused state.
2. In the controlled CLI, execute exactly one reviewed `createOrder` submission.
3. Do not show idempotency key or Circle resource IDs.
4. Wait for Circle status and public Arc receipt; submission is not finality.
5. Read canonical state. Required result: `Created`, exact buyer/amount/deadlines/termsHash/splits, `totalActiveEscrow` unchanged for this unfunded order.
6. **STOP on any mismatch or ambiguity. Do not retry.**

### Checkpoint L3 — hosted checkout and QR handoff

1. Open `https://settle-web-coral.vercel.app/pay/<fresh-orderId>`.
2. Show canonical `Created`, `0.05 USDC`, 90/10 split, correct buyer, Arc Testnet.
3. Call/show handoff API and verify `checkout.url == qr.payload == deeplink.url`.
4. Explain: “The QR encodes the canonical Settle hosted-checkout URL.”
5. Scan it on the buyer device; verify it opens the same Settle checkout and orderId.
6. State: “Scanning opens the checkout on the customer’s device. The customer’s wallet then authorizes the Arc USDC payment flow. The QR itself performs no blockchain transaction.”

### Checkpoint L4 — buyer identity and approval

1. Connect buyer wallet; verify address exactly equals the declared buyer and chain is Arc Testnet.
2. Read allowance immediately before action.
3. If allowance `<50000`, approve exactly `50000` base units to canonical SettlementEscrow. If allowance is already sufficient, explain and skip approval.
4. **STOP if allowance is unexpected; do not approve unlimited value or attempt cleanup during recording.**
5. Wait for successful receipt and refreshed allowance/canonical state.

### Checkpoint L5 — buyer funding

1. Reconfirm orderId, buyer, `Created`, unexpired funding deadline, amount, target, and sufficient allowance.
2. Submit `fundOrder(orderId)` from the buyer wallet once.
3. Wait for receipt and canonical read; do not treat wallet submission as finality.
4. Required result: `Funded`, active escrow includes `50000`, contract custody reflects funded USDC, buyer action no longer offers payment.
5. Show hosted checkout/API canonical Funded state. Optional evidence-panel degradation does not invalidate direct canonical state.
6. Explain that Settle now exposes canonical `Funded` state and the USDC is controlled in contract escrow pending fulfillment or resolution.

### Checkpoint L6 — controlled operator release

1. Confirm fulfillment/resolution decision is intentionally approved for this demo.
2. Re-read canonical state: exact fresh orderId, `Funded`, active escrow `50000`, expected recipients and split.
3. Dry-run the existing controlled Circle release plan and inspect publication-safe output.
4. Execute exactly one `releaseOrder` submission through the controlled Circle CLI.
5. Wait for Circle completion, Arc receipt, and canonical reads. **Never blindly retry an ambiguous submission.**
6. Required result: `Completed`, order escrow inactive, active escrow reduced by `50000`, settlement events/transfers of `45000` and `5000` base units.

### Checkpoint L7 — finality and split proof

1. Show production/API canonical `Completed` state and no buyer action.
2. Show ArcScan create, approval (if used), fund, and release transactions.
3. Show `SettlementPaid`/USDC `Transfer` evidence for gross `0.045` merchant and `0.005` platform payouts.
4. Use events for gross payout proof if the operator wallet’s net balance delta is fee-affected.
5. Return to the marketplace integration story: its checkout exposed Pay with USDC while Settle supplied the hosted wallet handoff, escrow, canonical state, deterministic settlement, and reconciliation evidence.
6. End on the architecture boundary: buyer signs customer transactions; the existing Circle-controlled operator path signs the reviewed operator action; contract custody and deterministic splits produce canonical Arc finality. Do not imply autonomous operator execution.

## POST-DEMO VERIFICATION

- [ ] Save fresh orderId and public Arc transaction hashes in the controlled evidence record.
- [ ] Confirm canonical `Completed`, exact termsHash, recipients, shares, timestamps, and no active escrow for the order.
- [ ] Confirm release events sum exactly to `50000` base units.
- [ ] Confirm contract USDC custody and `totalActiveEscrow` are consistent with all active orders; do not assume global zero if another order is funded.
- [ ] Confirm buyer allowance outcome and explain it accurately; do not submit cleanup writes for the video.
- [ ] Confirm every visible link uses production origin and every explorer link uses Arc Testnet.
- [ ] Redact/remove any frame containing sensitive identifiers or notifications.
- [ ] Preserve Circle IDs/recovery metadata only in internal grant/operator records.
- [ ] Do not perform additional retries, refunds, disputes, or “cleanup” writes after successful completion.
- [ ] Keep Demo 002 untouched and available as immutable historical evidence.
