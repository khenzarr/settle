# D4B3 Operator Execution Security

## Status

D4B3B2 is an offline, non-mutating security design. It does not add an execution route, submit a Circle transaction, generate a live idempotency UUID, or call `createOrder` / `releaseOrder`. The existing operator action route remains a dry-run planning capability with `executionRequired: false`.

Production operator execution remains disabled until Settle has both a real operator authentication source and durable, concurrency-safe execution storage.

## Trust boundaries

The browser may eventually request only a product operation (`create-order` or `release-order`) and an order ID. It cannot establish authorization by sending a role, operator boolean, expected origin, Circle wallet ID, idempotency key, target, ABI, calldata, execute flag, or retry control.

`OperatorAuthorizationGateway` is a server-side dependency that returns an `OperatorPrincipal`. Its default implementation fails closed. Tests can inject a principal, but there is no production bypass or invented authentication provider.

The provenance gate compares the request's exact `Origin` with a trusted server-configured origin. It also checks the effective host and protocol, using single-valued forwarded host/protocol headers when present. Missing, malformed, cross-origin, host-mismatched, protocol-mismatched, or multi-valued provenance is rejected. HTTPS is required unless an insecure development origin is explicitly enabled; CORS is not treated as CSRF protection.

## Identity and private record

The product identity is `(operation, normalized orderId)`. Create and release for one order are distinct identities; repeated create or repeated release identities collide.

The internal record owns:

- product identity;
- progress state;
- server-provisioned UUIDv4 idempotency identity;
- optional Circle transaction ID;
- optional validated public transaction hash;
- optional internal diagnostic data.

The browser request and public status do not contain the idempotency identity, Circle transaction ID, wallet ID, authorization data, raw SDK request/error, stack, recovery path, secrets, or internal database keys.

## State and duplicate policy

States are `prepared`, `submitting`, `submitted`, `confirmation-pending`, `complete`, `rejected`, and `ambiguous`.

- `prepared` has not been submitted and can proceed only after authorization, provenance, durable-store, and canonical-state gates.
- `submitting`, `submitted`, and `confirmation-pending` block duplicate execution. Submitted is not success.
- `complete` is terminal verified success and blocks blind replay.
- `rejected` is explicit non-ambiguous failure. A later attempt requires explicit re-preparation and fresh canonical checks.
- `ambiguous` blocks duplicates and preserves the existing idempotency identity.

Illegal backward transitions fail closed. There is no automatic-resubmit transition or retry loop.

## Ambiguous recovery

A timeout, Circle 5xx, lost response, or confirmation timeout can mean submission occurred. Such an outcome transitions to `ambiguous`; it never creates a new idempotency identity and never permits browser-driven retry. Recovery checks the existing submission with the retained server identity, Circle transaction status when known, and canonical chain state. If those cannot establish an outcome, the operation remains blocked for manual review.

## Persistence decision

Safe production execution cannot use request-local or process-local state. Idempotency ownership, duplicate exclusion, and ambiguous recovery must survive restarts and must coordinate multiple server instances. `OperatorExecutionStore` defines the required boundary. `InMemoryOperatorExecutionStore` is explicitly non-durable (`durable: false`) and exists only for tests/design; production capability checks reject it.

Selecting a durable database and implementing atomic create/compare-and-update semantics are prerequisites for a future execution phase, not work hidden inside this design phase.

## Publication-safe status

The public projection contains operation, normalized order ID, bounded state/status/message, whether recovery is pending, and—only after schema validation—a transaction hash and ArcScan URL derived by the canonical shared helper. Circle transaction IDs are omitted under least disclosure.