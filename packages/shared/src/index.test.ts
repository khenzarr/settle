import assert from "node:assert/strict";
import test from "node:test";

import {
  SETTLE_NAME, DisputeResolution, OrderStatus, calculateSettlementPayouts, evmAddressSchema, formatUsdcAmount,
  formatUsdcAmountFixed, hasActiveEscrowObligation, isTerminalOrderStatus,
  normalizeAddress, orderCreationInputSchema, orderIdSchema, orderStatusLabel,
  parseOrderStatus, parseUsdcAmount, parseUsdcAmountAllowZero, termsHashSchema, transactionHashSchema,
  storedOnchainOrderSchema, validateOrderCreationAt, validateSettlementSplits,
} from "./index.ts";

const ADDRESS_A = "0x0000000000000000000000000000000000000001";
const ADDRESS_B = "0x0000000000000000000000000000000000000002";
const ORDER_ID = `0x${"1".repeat(64)}`;
const TERMS_HASH = `0x${"2".repeat(64)}`;

test("exports the project name", () => {
  assert.equal(SETTLE_NAME, "Settle");
});

test("parses exact USDC examples and six-decimal boundary", () => {
  assert.equal(parseUsdcAmount("0.000001"), 1n);
  assert.equal(parseUsdcAmount("1"), 1_000_000n);
  assert.equal(parseUsdcAmount("1.2"), 1_200_000n);
  assert.equal(parseUsdcAmount("100.250000"), 100_250_000n);
  assert.equal(parseUsdcAmount("999999999999999999999999.999999"), 999999999999999999999999999999n);
});

test("rejects malformed USDC input and distinguishes zero policy", () => {
  for (const value of ["", " ", " 1", "1 ", "-1", "+1", "1e2", "0x10", "1,000", "1.2.3", "1.", ".1", "0.0000001", "0"]) assert.throws(() => parseUsdcAmount(value));
  assert.equal(parseUsdcAmountAllowZero("0"), 0n);
  assert.equal(parseUsdcAmount("0", { allowZero: true }), 0n);
});

test("formats USDC exactly and fixed output truncates", () => {
  assert.equal(formatUsdcAmount(1n), "0.000001");
  assert.equal(formatUsdcAmount(1_000_000n), "1");
  assert.equal(formatUsdcAmount(1_250_000n), "1.25");
  assert.equal(formatUsdcAmountFixed(1_250_000n, 2), "1.25");
  assert.equal(formatUsdcAmountFixed(1_000_000n, 2), "1.00");
  assert.equal(formatUsdcAmountFixed(1_259_999n, 2), "1.25");
  assert.equal(formatUsdcAmountFixed(1_999_999n, 0), "1");
  assert.equal(formatUsdcAmount(10n ** 100n), `${10n ** 94n}`);
  for (const digits of [-1, 7, 1.5, Number.NaN]) assert.throws(() => formatUsdcAmountFixed(1n, digits));
  assert.throws(() => formatUsdcAmount(-1n));
});

test("status helpers preserve ABI values and reject unknown values", () => {
  assert.deepEqual([OrderStatus.None, OrderStatus.Created, OrderStatus.Funded, OrderStatus.Disputed, OrderStatus.Completed, OrderStatus.Refunded, OrderStatus.Cancelled], [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(isTerminalOrderStatus(OrderStatus.Completed), true);
  assert.equal(isTerminalOrderStatus(OrderStatus.Funded), false);
  assert.equal(hasActiveEscrowObligation(OrderStatus.Disputed), true);
  assert.equal(hasActiveEscrowObligation(OrderStatus.Created), false);
  assert.equal(orderStatusLabel(OrderStatus.Refunded), "Refunded");
  assert.deepEqual([DisputeResolution.Release, DisputeResolution.Refund], [0, 1]);
  assert.throws(() => parseOrderStatus(7));
  assert.throws(() => parseOrderStatus(1.5));
  assert.throws(() => isTerminalOrderStatus(99 as OrderStatus));
});

test("validates addresses and bytes32 identifiers", () => {
  assert.equal(normalizeAddress(ADDRESS_A.toUpperCase().replace("0X", "0x")), ADDRESS_A);
  assert.equal(orderIdSchema.safeParse(ORDER_ID).success, true);
  assert.equal(orderIdSchema.safeParse(`0x${"0".repeat(64)}`).success, false);
  assert.equal(termsHashSchema.safeParse(`0x${"0".repeat(64)}`).success, false);
  assert.equal(orderIdSchema.safeParse("0x1234").success, false);
  assert.equal(transactionHashSchema.safeParse(`0x${"a".repeat(64)}`).success, true);
  assert.equal(transactionHashSchema.safeParse(`0x${"a".repeat(63)}`).success, false);
  assert.equal(evmAddressSchema.safeParse("0x1234").success, false);
});

test("validates one and eight recipient settlements", () => {
  assert.equal(validateSettlementSplits([{ recipient: ADDRESS_A, shareBps: 10_000 }]).length, 1);
  const eight = Array.from({ length: 8 }, (_, index) => ({ recipient: `0x${(index + 1).toString(16).padStart(40, "0")}`, shareBps: 1250 }));
  assert.equal(validateSettlementSplits(eight).length, 8);
});

test("rejects invalid settlement recipients, shares, and totals", () => {
  assert.throws(() => validateSettlementSplits([{ recipient: ADDRESS_A, shareBps: 5000 }, { recipient: ADDRESS_A.toUpperCase().replace("0X", "0x"), shareBps: 5000 }]));
  assert.throws(() => validateSettlementSplits([{ recipient: `0x${"0".repeat(40)}`, shareBps: 10_000 }]));
  assert.throws(() => validateSettlementSplits([{ recipient: ADDRESS_A, shareBps: 0 }]));
  assert.throws(() => validateSettlementSplits([{ recipient: ADDRESS_A, shareBps: 9_999 }]));
  assert.throws(() => validateSettlementSplits([{ recipient: ADDRESS_A, shareBps: 10_001 }]));
  assert.throws(() => validateSettlementSplits([]));
  assert.throws(() => validateSettlementSplits(Array.from({ length: 9 }, (_, index) => ({ recipient: `0x${(index + 1).toString(16).padStart(40, "0")}`, shareBps: index === 8 ? 1112 : 1111 }))));
});

test("calculates Solidity-aligned payouts and assigns the final remainder", () => {
  const payouts = calculateSettlementPayouts(101n, [{ recipient: ADDRESS_A, shareBps: 3333 }, { recipient: ADDRESS_B, shareBps: 6667 }]);
  assert.deepEqual(payouts, [33n, 68n]);
  assert.equal(payouts.reduce((sum, payout) => sum + payout, 0n), 101n);
  assert.deepEqual(calculateSettlementPayouts(10n, [{ recipient: ADDRESS_A, shareBps: 10_000 }]), [10n]);
  const huge = 10n ** 80n + 7n;
  const hugePayouts = calculateSettlementPayouts(huge, [{ recipient: ADDRESS_A, shareBps: 5000 }, { recipient: ADDRESS_B, shareBps: 5000 }]);
  assert.equal(hugePayouts[0] + hugePayouts[1], huge);
});

test("validates order creation independently from wall-clock time", () => {
  const order = { orderId: ORDER_ID, buyer: ADDRESS_A, totalAmount: 1n, fundingDeadline: 100n, settlementDeadline: 200n, termsHash: TERMS_HASH, splits: [{ recipient: ADDRESS_B, shareBps: 10_000 }] };
  assert.equal(orderCreationInputSchema.parse(order).fundingDeadline, 100n);
  assert.equal(validateOrderCreationAt(order, 99n).orderId, ORDER_ID);
  assert.throws(() => orderCreationInputSchema.parse({ ...order, settlementDeadline: 100n }));
  assert.throws(() => orderCreationInputSchema.parse({ ...order, orderId: `0x${"0".repeat(64)}` }));
  assert.throws(() => orderCreationInputSchema.parse({ ...order, termsHash: `0x${"0".repeat(64)}` }));
  assert.throws(() => orderCreationInputSchema.parse({ ...order, buyer: `0x${"0".repeat(40)}` }));
  assert.throws(() => orderCreationInputSchema.parse({ ...order, totalAmount: 0n }));
  assert.throws(() => orderCreationInputSchema.parse({ ...order, fundingDeadline: 0n }));
  assert.throws(() => validateOrderCreationAt(order, 100n));
  assert.throws(() => validateOrderCreationAt(order, -1n));
});

test("validates stored onchain orders and rejects unknown status values", () => {
  const stored = { buyer: ADDRESS_A, totalAmount: 1n, fundingDeadline: 100n, settlementDeadline: 200n, termsHash: TERMS_HASH, createdAt: 10n, fundedAt: 0n, disputedAt: 0n, settledAt: 0n, refundedAt: 0n, cancelledAt: 0n, status: OrderStatus.Created };
  assert.equal(storedOnchainOrderSchema.parse(stored).status, OrderStatus.Created);
  assert.throws(() => storedOnchainOrderSchema.parse({ ...stored, status: 99 }));
});