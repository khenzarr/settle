import assert from "node:assert/strict";
import test from "node:test";

import { decodeFunctionData } from "viem";

import * as intentApi from "./settlement-transaction-intent.ts";
import { settlementEscrowAbi } from "./abi/SettlementEscrow.ts";
import {
  ARC_TESTNET,
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
  parseUsdcAmount,
  prepareBuyerTransactionIntent,
} from "./index.ts";

const OPERATOR = "0x0000000000000000000000000000000000000001";
const BUYER = "0x0000000000000000000000000000000000000002";
const RECIPIENT = "0x0000000000000000000000000000000000000003";
const ORDER_ID = `0x${"1".repeat(64)}`;
const TERMS_HASH = `0x${"2".repeat(64)}`;

const createdOrder = {
  orderId: ORDER_ID,
  buyer: BUYER,
  totalAmount: parseUsdcAmount("42.123456"),
  status: OrderStatus.Created,
} as const;

const createInput = {
  operatorAddress: OPERATOR,
  currentTimestamp: 1_000n,
  orderId: ORDER_ID,
  buyer: BUYER,
  totalAmountUsdc: "42.123456",
  fundingDeadline: 2_000n,
  settlementDeadline: 3_000n,
  termsHash: TERMS_HASH,
  splits: [{ recipient: RECIPIENT, shareBps: 10_000 }],
} as const;

test("prepares exact canonical approve calldata for the buyer", () => {
  const plan = createApproveUsdcPlan({ order: createdOrder });
  const intent = prepareBuyerTransactionIntent(plan);
  const decoded = decodeFunctionData({
    abi: [{
      type: "function",
      name: "approve",
      stateMutability: "nonpayable",
      inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
      outputs: [{ name: "", type: "bool" }],
    }] as const,
    data: intent.data,
  });

  assert.equal(intent.operation, "approve-usdc");
  assert.equal(intent.chainId, 5_042_002);
  assert.equal(intent.from, BUYER);
  assert.equal(intent.to, ARC_TESTNET.usdc.address);
  assert.equal(intent.value, 0n);
  assert.deepEqual(intent.expectedSigner, { kind: "buyer", address: BUYER });
  assert.equal(decoded.functionName, "approve");
  assert.equal(decoded.args?.[0]?.toLowerCase(), ARC_TESTNET.settlementEscrow.address);
  assert.equal(decoded.args?.[1], createdOrder.totalAmount);
});

test("prepares exact fundOrder calldata and retains approval prerequisite", () => {
  const plan = createFundOrderPlan({ order: createdOrder });
  const intent = prepareBuyerTransactionIntent(plan);
  const decoded = decodeFunctionData({ abi: settlementEscrowAbi, data: intent.data });

  assert.equal(intent.operation, "fund-order");
  assert.equal(intent.chainId, ARC_TESTNET.chainId);
  assert.equal(intent.from, BUYER);
  assert.equal(intent.to, ARC_TESTNET.settlementEscrow.address);
  assert.equal(intent.value, 0n);
  assert.equal(decoded.functionName, "fundOrder");
  assert.deepEqual(decoded.args, [ORDER_ID]);
  assert.deepEqual(intent.prerequisites, plan.prerequisites);
  assert.equal(intent.prerequisites.some((item) => item.kind === "exact-usdc-allowance"), true);
});

test("prepares exact zero-value public cancel intent for canonical target and order", () => {
  const intent = prepareBuyerTransactionIntent(createCancelExpiredOrderPlan({ callerAddress: RECIPIENT, order: createdOrder, fundingDeadline: 2_000n, currentTimestamp: 2_001n }));
  const decoded = decodeFunctionData({ abi: settlementEscrowAbi, data: intent.data });
  assert.equal(intent.operation, "cancel-expired-order");
  assert.equal(intent.to, ARC_TESTNET.settlementEscrow.address);
  assert.equal(intent.value, 0n);
  assert.deepEqual(intent.expectedSigner, { kind: "public", address: RECIPIENT });
  assert.equal(decoded.functionName, "cancelExpiredOrder");
  assert.deepEqual(decoded.args, [ORDER_ID]);
});

test("prepares exact zero-value buyer dispute intent and rejects privileged lifecycle plans", () => {
  const funded = { ...createdOrder, status: OrderStatus.Funded } as const;
  const intent = prepareBuyerTransactionIntent(createRaiseDisputePlan({ callerAddress: BUYER, callerKind: "buyer", order: funded }));
  const decoded = decodeFunctionData({ abi: settlementEscrowAbi, data: intent.data });
  assert.equal(intent.operation, "raise-dispute");
  assert.equal(intent.to, ARC_TESTNET.settlementEscrow.address);
  assert.equal(intent.value, 0n);
  assert.deepEqual(intent.expectedSigner, { kind: "buyer", address: BUYER });
  assert.equal(decoded.functionName, "raiseDispute");
  assert.deepEqual(decoded.args, [ORDER_ID]);
  assert.throws(() => prepareBuyerTransactionIntent(createRaiseDisputePlan({ callerAddress: OPERATOR, callerKind: "operator", order: funded })));
  assert.throws(() => prepareBuyerTransactionIntent(createRefundOrderPlan({ operatorAddress: OPERATOR, order: funded })));
  assert.throws(() => prepareBuyerTransactionIntent(createResolveDisputePlan({ arbitratorAddress: OPERATOR, order: { ...funded, status: OrderStatus.Disputed }, resolution: 1, splits: [] })));
});

test("rejects operator create and release plans", () => {
  assert.throws(() => prepareBuyerTransactionIntent(createCreateOrderPlan(createInput)));
  assert.throws(() => prepareBuyerTransactionIntent(createReleaseOrderPlan({
    operatorAddress: OPERATOR,
    order: { ...createdOrder, status: OrderStatus.Funded },
    splits: createInput.splits,
  })));
});

test("rejects non-buyer signer and does not infer a buyer address", () => {
  const plan = createFundOrderPlan({ order: createdOrder });
  const tampered = {
    ...plan,
    expectedSigner: { kind: MarketplaceSignerKind.Operator, address: OPERATOR },
  } as typeof plan;
  assert.throws(() => prepareBuyerTransactionIntent(tampered));
});

test("rejects wrong canonical target, malformed data, and missing approval", () => {
  const approve = createApproveUsdcPlan({ order: createdOrder });
  assert.throws(() => prepareBuyerTransactionIntent({ ...approve, targetAddress: ARC_TESTNET.settlementEscrow.address }));
  assert.throws(() => prepareBuyerTransactionIntent({ ...approve, abiParameters: [ARC_TESTNET.settlementEscrow.address, "not-an-amount"] } as unknown as typeof approve));

  const fund = createFundOrderPlan({ order: createdOrder });
  assert.throws(() => prepareBuyerTransactionIntent({
    ...fund,
    prerequisites: fund.prerequisites.filter((item) => item.kind !== "exact-usdc-allowance"),
  }));
  assert.throws(() => prepareBuyerTransactionIntent({ ...fund, abiParameters: ["0x1234"] } as typeof fund));
});

test("does not create a direct USDC transfer intent or expose execution APIs", () => {
  assert.equal(intentApi.prepareBuyerTransactionIntent.name, "prepareBuyerTransactionIntent");
  assert.deepEqual(Object.keys(intentApi), ["prepareBuyerTransactionIntent"]);
  assert.equal("sendTransaction" in intentApi, false);
  assert.equal("writeContract" in intentApi, false);
  assert.equal("signTransaction" in intentApi, false);
  assert.equal("walletClient" in intentApi, false);
});