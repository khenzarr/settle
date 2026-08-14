# M1.E Finalized Arc reconciliation

## Scope

M1.E adds a resumable, read-only Arc Testnet reconciliation worker. It scans canonical
SettlementEscrow lifecycle logs through a confirmation-delayed safe head, persists
normalized observations, verifies complete contract state at an explicit block tag,
projects Payment Intent state, correlates activation transaction evidence, records
divergence, and emits merchant webhooks only from finalized evidence.

The worker is invoked from a protected scheduler or worker runtime:

```text
pnpm reconciliation:work -- --runs=1
```

No public execution endpoint is added.

## Persistence

Migration `0004_m1_e_reconciliation.sql` adds:

- `chain_reconciliation_cursors`: one leased, resumable cursor per chain and contract
- `chain_observations`: normalized canonical/orphaned log evidence with payload hashes
- `reconciliation_issues`: tenant-aware or system-level ambiguity and divergence records

`operator_executions` gains optional provider-operation and canonical transaction evidence
fields. A transaction hash must be paired with chain ID and observation time.

## Finality and cursor policy

The worker validates the RPC chain ID and scans only through:

```text
safeBlock = latestBlock - confirmationDepth
```

The default confirmation depth is 12 and is bounded from 1 to 1024. Scan chunks and the
maximum blocks processed by one run are independently bounded. Workers claim the cursor
with `FOR UPDATE SKIP LOCKED` and a finite lease, so concurrent scheduler invocations do
not process the same cursor.

Every successful batch stores the exact block number and block hash of its checkpoint.
The next run re-reads that anchor before advancing.

## Reorg policy

If the stored checkpoint hash no longer matches the RPC block hash, the worker fails
closed:

1. Previously canonical observations for the cursor become `orphaned`.
2. Affected `chain_orders` become `stale` and lose their prior verified block evidence.
3. Affected Payment Intents return to `awaiting_activation` with
   `reconciliation_state = reorg_pending`.
4. A tenant reconciliation issue and signed webhook are created.
5. The cursor restarts from the documented SettlementEscrow deployment block.

The worker never preserves `funded`, `completed`, or another chain-derived state merely
because it was previously observed.

## Canonical verification

For each observed order, M1.E reads `orderExists`, `getOrder`, and
`getSettlementSplits` at the explicit finalized checkpoint. It compares the complete
immutable binding against the Payment Intent:

- order ID
- buyer
- exact USDC base-unit amount
- funding and settlement deadlines
- terms hash
- ordered recipient addresses
- ordered recipient shares

Only an exact match receives `verification_state = verified`, a checkout path, and a
canonical application-state projection. Any mismatch leaves the Payment Intent visibly
`diverged`, stores the canonical chain projection with error verification, opens a
reconciliation issue, and emits no successful lifecycle transition.

Zero matches create an `unmatched_chain_order` issue. Multiple matching Payment Intents
create an `ambiguous_payment_intent` issue. Malformed RPC/ABI responses stop the cursor
without checkpoint advancement.

## State and event projection

Verified contract states map to Payment Intent states as follows:

| SettlementEscrow | Payment Intent |
| --- | --- |
| Created before funding deadline | `awaiting_payment` |
| Created at/after funding deadline | `payment_window_expired` |
| Funded | `funded` |
| Disputed | `disputed` |
| Completed | `completed` |
| Refunded | `refunded` |
| Cancelled | `cancelled` |

Finalized lifecycle observations emit stable semantic events for activated, funded,
disputed, completed, refunded, and cancelled transitions. The Payment Intent expiry event
uses the immutable funding deadline as its semantic key. Event identity includes the Arc
transaction hash and log index, providing deduplication across retries while allowing a
replacement canonical event after a reorg.

## Security boundary

M1.E uses read-only JSON-RPC methods. It does not:

- sign or submit Arc transactions
- release, refund, dispute, resolve, or cancel orders
- call Circle APIs
- infer success from a provider submission, transaction hash, or receipt alone
- expose cursor or worker mutation through a public route
- perform CCTP or gas sponsorship

SettlementEscrow remains authoritative. PostgreSQL stores operational projections and
evidence, never an alternative source of payment truth.

## Verification gates

The M1.E gates cover bounded configuration, explicit finalized block tags, immutable
field comparison, state/event mapping, deterministic keys, cursor advancement, restart
idempotency, canonical projection, and block-hash reorg invalidation. Existing merchant,
Payment Intent, webhook, Circle, web, and Foundry regression suites remain required.
