import assert from "node:assert/strict";
import test from "node:test";

import * as commandPlanApi from "./settlement-command-plan.ts";
import {
  ARC_TESTNET,
  MARKETPLACE_COMMAND_ABI_SIGNATURES,
  MarketplaceSignerKind,
  OrderStatus,
  createApproveUsdcPlan,
  createCreateOrderPlan,
  createFundOrderPlan,
  createCancelExpiredOrderPlan,
  createRaiseDisputePlan,
  createRefundOrderPlan,
  createResolveDisputePlan,
  createReleaseOrderPlan,
  DisputeResolution,
  parseUsdcAmount,
} from "./index.ts";

const OPERATOR = "0x0000000000000000000000000000000000000001";
const BUYER = "0x0000000000000000000000000000000000000002";
const RECIPIENT_A = "0x0000000000000000000000000000000000000003";
const RECIPIENT_B = "0x0000000000000000000000000000000000000004";
const ORDER_ID = `0x${"1".repeat(64)}`;
const TERMS_HASH = `0x${"2".repeat(64)}`;
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;
const ZERO_BYTES32 = `0x${"0".repeat(64)}`;

const createInput = {
  operatorAddress: OPERATOR,
  currentTimestamp: 1_000n,
  orderId: ORDER_ID,
  buyer: BUYER,
  totalAmountUsdc: "42.123456",
  fundingDeadline: 2_000n,
  settlementDeadline: 3_000n,
  termsHash: TERMS_HASH,
  splits: [
    { recipient: RECIPIENT_A, shareBps: 2_500 },
    { recipient: RECIPIENT_B, shareBps: 7_500 },
  ],
} as const;

const createdOrder = {
  orderId: ORDER_ID,
  buyer: BUYER,
  totalAmount: parseUsdcAmount(createInput.totalAmountUsdc),
  status: OrderStatus.Created,
} as const;

test("builds a valid create-order plan with exact parameter ordering", () => {
  const plan = createCreateOrderPlan(createInput);

  assert.equal(plan.operation, "create-order");
  assert.equal(plan.chain.chainId, ARC_TESTNET.chainId);
  assert.equal(plan.targetAddress, ARC_TESTNET.settlementEscrow.address);
  assert.equal(plan.abiFunctionSignature, MARKETPLACE_COMMAND_ABI_SIGNATURES.createOrder);
  assert.deepEqual(plan.abiParameters, [
    ORDER_ID,
    BUYER,
    42_123_456n,
    2_000n,
    3_000n,
    TERMS_HASH,
    [RECIPIENT_A, RECIPIENT_B],
    [2_500, 7_500],
  ]);
  assert.deepEqual(plan.expectedSigner, { kind: MarketplaceSignerKind.Operator, address: OPERATOR });
  assert.deepEqual(plan.expectedStateTransition, {
    system: "settlement-escrow",
    from: OrderStatus.None,
    to: OrderStatus.Created,
  });
  assert.deepEqual(plan.expectedUsdcEffect, { kind: "none", amount: 0n });
  assert.equal(plan.changesChainState, true);
});

test("rejects invalid create-order identifiers and participants", () => {
  assert.throws(() => createCreateOrderPlan({ ...createInput, orderId: ZERO_BYTES32 }));
  assert.throws(() => createCreateOrderPlan({ ...createInput, buyer: ZERO_ADDRESS }));
});

test("rejects invalid create-order deadlines and terms hash", () => {
  assert.throws(() => createCreateOrderPlan({ ...createInput, fundingDeadline: createInput.currentTimestamp }));
  assert.throws(() => createCreateOrderPlan({ ...createInput, settlementDeadline: createInput.fundingDeadline }));
  assert.throws(() => createCreateOrderPlan({ ...createInput, termsHash: ZERO_BYTES32 }));
});

test("rejects invalid create-order settlement splits", () => {
  assert.throws(() => createCreateOrderPlan({
    ...createInput,
    splits: [{ recipient: RECIPIENT_A, shareBps: 9_999 }],
  }));
});

test("preserves an exact six-decimal USDC amount as bigint base units", () => {
  const plan = createCreateOrderPlan({ ...createInput, totalAmountUsdc: "0.000001" });
  assert.equal(plan.abiParameters[2], 1n);
  assert.throws(() => createCreateOrderPlan({ ...createInput, totalAmountUsdc: "0.0000001" }));
});

test("builds exact canonical approval intent for the stored buyer and total", () => {
  const plan = createApproveUsdcPlan({ order: createdOrder });

  assert.equal(plan.targetAddress, ARC_TESTNET.usdc.address);
  assert.equal(plan.abiFunctionSignature, MARKETPLACE_COMMAND_ABI_SIGNATURES.approveUsdc);
  assert.deepEqual(plan.abiParameters, [ARC_TESTNET.settlementEscrow.address, createdOrder.totalAmount]);
  assert.deepEqual(plan.expectedSigner, { kind: MarketplaceSignerKind.Buyer, address: BUYER });
  assert.equal(plan.expectedUsdcEffect.kind, "allowance-set");
  assert.equal(plan.expectedUsdcEffect.amount, createdOrder.totalAmount);
  assert.deepEqual(plan.expectedStateTransition, { system: "erc20-allowance", from: null, to: null });
});

test("fund-order requires the exact stored buyer and approval prerequisite", () => {
  const plan = createFundOrderPlan({ order: createdOrder });

  assert.equal(plan.abiFunctionSignature, MARKETPLACE_COMMAND_ABI_SIGNATURES.fundOrder);
  assert.deepEqual(plan.abiParameters, [ORDER_ID]);
  assert.deepEqual(plan.expectedSigner, { kind: MarketplaceSignerKind.Buyer, address: BUYER });
  assert.deepEqual(plan.prerequisites, [
    { kind: "order-status", orderId: ORDER_ID, status: OrderStatus.Created },
    {
      kind: "exact-usdc-allowance",
      owner: BUYER,
      spender: ARC_TESTNET.settlementEscrow.address,
      amount: createdOrder.totalAmount,
    },
  ]);
  assert.deepEqual(plan.expectedStateTransition, {
    system: "settlement-escrow",
    from: OrderStatus.Created,
    to: OrderStatus.Funded,
  });
  assert.equal(plan.expectedUsdcEffect.kind, "escrow-funded");
  assert.match(plan.expectedUsdcEffect.mechanism, /fundOrder transferFrom/);
  assert.equal(plan.abiFunctionSignature.includes("transfer"), false);
});

test("release-order requires operator and projects contract-performed split payout", () => {
  const plan = createReleaseOrderPlan({
    operatorAddress: OPERATOR,
    order: { ...createdOrder, totalAmount: 101n, status: OrderStatus.Funded },
    splits: createInput.splits,
  });

  assert.equal(plan.abiFunctionSignature, MARKETPLACE_COMMAND_ABI_SIGNATURES.releaseOrder);
  assert.deepEqual(plan.abiParameters, [ORDER_ID]);
  assert.deepEqual(plan.expectedSigner, { kind: MarketplaceSignerKind.Operator, address: OPERATOR });
  assert.deepEqual(plan.expectedStateTransition, {
    system: "settlement-escrow",
    from: OrderStatus.Funded,
    to: OrderStatus.Completed,
  });
  assert.deepEqual(plan.expectedUsdcEffect.payouts.map((payout) => payout.amount), [25n, 76n]);
  assert.equal("commands" in plan, false);
  assert.equal("transfers" in plan, false);
  assert.equal(plan.abiFunctionSignature.includes("transfer"), false);
});

test("uses the exact lifecycle ABI signatures", () => {
  assert.deepEqual(MARKETPLACE_COMMAND_ABI_SIGNATURES, {
    createOrder: "createOrder(bytes32,address,uint256,uint256,uint256,bytes32,address[],uint16[])",
    approveUsdc: "approve(address,uint256)",
    fundOrder: "fundOrder(bytes32)",
    releaseOrder: "releaseOrder(bytes32)",
    cancelExpiredOrder: "cancelExpiredOrder(bytes32)",
    raiseDispute: "raiseDispute(bytes32)",
    refundOrder: "refundOrder(bytes32)",
    resolveDispute: "resolveDispute(bytes32,uint8)",
  });
});

test("cancel requires Created and strict timestamp expiry, permits any caller, and moves no USDC", () => {
  assert.throws(() => createCancelExpiredOrderPlan({ callerAddress: RECIPIENT_A, order: createdOrder, fundingDeadline: 2_000n, currentTimestamp: 2_000n }));
  const plan = createCancelExpiredOrderPlan({ callerAddress: RECIPIENT_A, order: createdOrder, fundingDeadline: 2_000n, currentTimestamp: 2_001n });
  assert.equal(plan.abiFunctionSignature, "cancelExpiredOrder(bytes32)");
  assert.deepEqual(plan.abiParameters, [ORDER_ID]);
  assert.deepEqual(plan.expectedSigner, { kind: MarketplaceSignerKind.Public, address: RECIPIENT_A });
  assert.deepEqual(plan.expectedStateTransition, { system: "settlement-escrow", from: OrderStatus.Created, to: OrderStatus.Cancelled });
  assert.deepEqual(plan.expectedUsdcEffect, { kind: "none", amount: 0n });
  assert.throws(() => createCancelExpiredOrderPlan({ callerAddress: RECIPIENT_A, order: { ...createdOrder, status: OrderStatus.Cancelled }, fundingDeadline: 2_000n, currentTimestamp: 2_001n }));
});

test("buyer dispute requires Funded and exact stored buyer while operator authority stays distinct", () => {
  const funded = { ...createdOrder, status: OrderStatus.Funded } as const;
  assert.throws(() => createRaiseDisputePlan({ callerAddress: BUYER, callerKind: "buyer", order: createdOrder }));
  assert.throws(() => createRaiseDisputePlan({ callerAddress: RECIPIENT_A, callerKind: "buyer", order: funded }));
  const plan = createRaiseDisputePlan({ callerAddress: BUYER, callerKind: "buyer", order: funded });
  assert.equal(plan.abiFunctionSignature, "raiseDispute(bytes32)");
  assert.deepEqual(plan.abiParameters, [ORDER_ID]);
  assert.deepEqual(plan.expectedStateTransition, { system: "settlement-escrow", from: OrderStatus.Funded, to: OrderStatus.Disputed });
  assert.deepEqual(plan.expectedUsdcEffect, { kind: "none", amount: 0n });
});

test("operator refund models full return without granting browser authority", () => {
  const plan = createRefundOrderPlan({ operatorAddress: OPERATOR, order: { ...createdOrder, status: OrderStatus.Funded } });
  assert.equal(plan.abiFunctionSignature, "refundOrder(bytes32)");
  assert.deepEqual(plan.abiParameters, [ORDER_ID]);
  assert.equal(plan.expectedSigner.kind, MarketplaceSignerKind.Operator);
  assert.deepEqual(plan.expectedStateTransition, { system: "settlement-escrow", from: OrderStatus.Funded, to: OrderStatus.Refunded });
  assert.deepEqual(plan.expectedUsdcEffect, { kind: "full-refund", from: ARC_TESTNET.settlementEscrow.address, to: BUYER, amount: createdOrder.totalAmount, mechanism: "SettlementEscrow refundOrder" });
});

test("arbitrator resolution preserves uint8 enum outcomes Release=0 and Refund=1", () => {
  const disputed = { ...createdOrder, totalAmount: 101n, status: OrderStatus.Disputed } as const;
  const release = createResolveDisputePlan({ arbitratorAddress: OPERATOR, order: disputed, resolution: DisputeResolution.Release, splits: createInput.splits });
  const refund = createResolveDisputePlan({ arbitratorAddress: OPERATOR, order: disputed, resolution: DisputeResolution.Refund, splits: [] });
  assert.equal(release.abiFunctionSignature, "resolveDispute(bytes32,uint8)");
  assert.deepEqual(release.abiParameters, [ORDER_ID, 0]);
  assert.deepEqual(refund.abiParameters, [ORDER_ID, 1]);
  assert.equal(release.expectedStateTransition.to, OrderStatus.Completed);
  assert.equal(refund.expectedStateTransition.to, OrderStatus.Refunded);
  assert.equal(release.expectedSigner.kind, MarketplaceSignerKind.Arbitrator);
  assert.throws(() => createResolveDisputePlan({ arbitratorAddress: OPERATOR, order: disputed, resolution: 2 as DisputeResolution, splits: [] }));
});

test("does not expose execution or write-client capability", () => {
  const forbidden = /execute|send|write|wallet|client|transport/i;
  assert.deepEqual(Object.keys(commandPlanApi).filter((key) => forbidden.test(key)), []);

  const plans = [
    createCreateOrderPlan(createInput),
    createApproveUsdcPlan({ order: createdOrder }),
    createFundOrderPlan({ order: createdOrder }),
    createReleaseOrderPlan({
      operatorAddress: OPERATOR,
      order: { ...createdOrder, status: OrderStatus.Funded },
      splits: createInput.splits,
    }),
  ];
  for (const plan of plans) {
    assert.deepEqual(Object.keys(plan).filter((key) => forbidden.test(key)), []);
  }
});