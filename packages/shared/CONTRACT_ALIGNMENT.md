# SettlementEscrow contract alignment

- `OrderStatus` maps exactly to Solidity: `None=0`, `Created=1`, `Funded=2`, `Disputed=3`, `Completed=4`, `Refunded=5`, `Cancelled=6`.
- `DisputeResolution` maps exactly to Solidity: `Release=0`, `Refund=1`.
- USDC application accounting uses six-decimal base units represented by TypeScript `bigint`.
- Settlement shares are basis points and must total 10,000. Each non-final payout is `totalAmount * share / 10_000` using integer division. The final recipient receives `totalAmount - amountDistributed`, preserving the full amount.
- Blockchain timestamps are non-negative `bigint` values representing Unix seconds.
- EVM addresses accept lowercase or checksummed-looking hexadecimal input. Lowercase normalization is used for comparison; this package does not fabricate checksums.
- `StoredOnchainOrder` maps to `SettlementEscrow.Order`: `buyer`, `totalAmount`, `fundingDeadline`, `settlementDeadline`, `termsHash`, `createdAt`, `fundedAt`, `disputedAt`, `settledAt`, `refundedAt`, `cancelledAt`, and `status`. Settlement splits map to the separately stored recipient and `uint16` share arrays.

The domain types in this package are maintained manually and kept aligned with Solidity. The `SettlementEscrow` contract ABI is generated separately from the Foundry artifact into `src/abi/SettlementEscrow.ts` and exported through the package's public API. The ABI pipeline exports only the ABI; it does not export Foundry metadata or bytecode.