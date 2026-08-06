# Foundry Warning Review

Reviewed with Foundry `1.7.1` using `forge build --root packages/contracts`.

No warning is globally suppressed. No production code was changed during this review because the diagnostics did not demonstrate a production defect.

## Expected and justified production warnings

| Location | Warning | Classification | Review |
| --- | --- | --- | --- |
| `SettlementEscrow.sol:198` | `block-timestamp` | Expected and justified | Order creation must reject funding deadlines that are not in the future. Minor validator timestamp latitude does not invalidate the intended coarse-grained marketplace deadline check. |
| `SettlementEscrow.sol:234` | `block-timestamp` | Expected and justified | Funding eligibility is explicitly defined by the configured timestamp boundary. This is business deadline logic, not randomness or exact block-time consensus logic. |
| `SettlementEscrow.sol:258` | `block-timestamp` | Expected and justified | Public cancellation begins at the configured funding deadline. The timestamp comparison directly implements the lifecycle rule. |

These checks should continue to use sufficiently practical deadline windows. Applications must not represent block timestamps as wall-clock guarantees to sub-block precision.

## Test-only warnings

| Location | Warning | Classification | Review |
| --- | --- | --- | --- |
| `SettlementEscrowFuzz.t.sol:97` | `unsafe-typecast` | Test-only | A short literal is converted to `bytes32` solely as a deterministic invalid-test identifier. |
| `SettlementEscrowFuzz.t.sol:229,231,234` | `unsafe-typecast` | Test-only | Generated addresses and shares are bounded by recipient count and the `10_000` basis-point remainder, so values fit `uint160` and `uint16`. |
| `SettlementEscrow.t.sol:273` | `unsafe-typecast` | Test-only | The loop is fixed to nine small positive values before conversion to test addresses. |
| `SettlementEscrowInvariant.t.sol:106,111,112` | `unsafe-typecast` | Test-only | Invariant indices are capped by `MAX_ORDERS = 12`; generated address values are far below the `uint160` limit. |
| `SettlementEscrowHandler.sol:58,123` | `block-timestamp` | Test-only | The handler mirrors production deadline guards so invariant actions are attempted only in valid modeled states. |

## Requiring correction

None identified. The production timestamp warnings describe intentional lifecycle boundaries, and all conversion warnings reported in the baseline are confined to bounded test-data construction.

## Review policy

Re-run diagnostics after Solidity, Foundry, or test-generator changes. Correct any newly reported production conversion warning unless a local proof shows the conversion is bounded and intentional. Prefer explicit bounds or safer types over global lint suppression.