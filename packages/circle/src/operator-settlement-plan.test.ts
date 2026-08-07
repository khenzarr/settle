import assert from "node:assert/strict";
import test from "node:test";

import type { CreateContractExecutionTransactionInput } from "@circle-fin/developer-controlled-wallets";
import {
  ARC_TESTNET,
  MARKETPLACE_COMMAND_ABI_SIGNATURES,
  MarketplaceSignerKind,
  OrderStatus,
  createApproveUsdcPlan,
  createCreateOrderPlan,
  createFundOrderPlan,
  createReleaseOrderPlan,
  type MarketplaceCommandPlan,
} from "@settle/shared";

import { CircleMutationAmbiguousError, CircleMutationRejectedError } from "./wallet-mutations.ts";
import { prepareOperatorSettlementExecution, runOperatorSettlementExecution } from "./operator-settlement-plan.ts";
import type { WalletContractExecutionGateway } from "./wallet-contract-execution.ts";
import type { CircleWalletRecord } from "./wallets.ts";

const OPERATOR = "0x0000000000000000000000000000000000000001";
const OTHER_OPERATOR = "0x0000000000000000000000000000000000000002";
const BUYER = "0x0000000000000000000000000000000000000003";
const RECIPIENT_A = "0x0000000000000000000000000000000000000004";
const RECIPIENT_B = "0x0000000000000000000000000000000000000005";
const WRONG_TARGET = "0x0000000000000000000000000000000000000006";
const ORDER_ID = `0x${"1".repeat(64)}`;
const TERMS_HASH = `0x${"2".repeat(64)}`;
const WALLET_ID = "configured-wallet-id";
const IDEMPOTENCY_KEY = "123e4567-e89b-42d3-a456-426614174000";
const TRANSACTION_ID = "123e4567-e89b-42d3-a456-426614174001";

const splits = [
  { recipient: RECIPIENT_A, shareBps: 2_500 },
  { recipient: RECIPIENT_B, shareBps: 7_500 },
] as const;

const createPlan = createCreateOrderPlan({
  operatorAddress: OPERATOR,
  currentTimestamp: 1_000n,
  orderId: ORDER_ID,
  buyer: BUYER,
  totalAmountUsdc: "42.123456",
  fundingDeadline: 2_000n,
  settlementDeadline: 3_000n,
  termsHash: TERMS_HASH,
  splits,
});

const createdOrder = {
  orderId: ORDER_ID,
  buyer: BUYER,
  totalAmount: 42_123_456n,
  status: OrderStatus.Created,
} as const;

const releasePlan = createReleaseOrderPlan({
  operatorAddress: OPERATOR,
  order: { ...createdOrder, status: OrderStatus.Funded },
  splits,
});

const wallet: CircleWalletRecord = {
  id: WALLET_ID,
  walletSetId: "configured-wallet-set-id",
  address: OPERATOR,
  blockchain: "ARC-TESTNET",
  accountType: "EOA",
  custodyType: "DEVELOPER",
  state: "LIVE",
};

test("create-order operator plan maps to the exact Circle contract execution plan", () => {
  const preparation = prepare(createPlan);

  assert.equal(preparation.operation, "create-order");
  assert.equal(preparation.operatorSigner, OPERATOR);
  assert.equal(preparation.contractAddress, ARC_TESTNET.settlementEscrow.address);
  assert.equal(preparation.abiFunctionSignature, MARKETPLACE_COMMAND_ABI_SIGNATURES.createOrder);
  assert.equal(preparation.parameterCount, 8);
  assert.deepEqual(preparation.expectedStateTransition, createPlan.expectedStateTransition);
  assert.deepEqual(preparation.contractExecutionPlan, {
    operation: "wallet contract execution",
    blockchain: "ARC-TESTNET",
    sourceAddress: OPERATOR,
    contractAddress: ARC_TESTNET.settlementEscrow.address,
    functionSignature: "createOrder(bytes32,address,uint256,uint256,uint256,bytes32,address[],uint16[])",
    parameters: [
      ORDER_ID,
      BUYER,
      "42123456",
      "2000",
      "3000",
      TERMS_HASH,
      [RECIPIENT_A, RECIPIENT_B],
      [2_500, 7_500],
    ],
    parameterCount: 8,
    feeLevel: "MEDIUM",
    executionRequired: false,
  });
});

test("release-order operator plan maps to the exact Circle contract execution plan", () => {
  const preparation = prepareOperatorSettlementExecution({
    plan: releasePlan,
    configuredWalletAddress: OPERATOR,
    configuredOperatorAddress: OPERATOR,
    feeLevel: "low",
  });

  assert.equal(preparation.abiFunctionSignature, MARKETPLACE_COMMAND_ABI_SIGNATURES.releaseOrder);
  assert.deepEqual(preparation.contractExecutionPlan.parameters, [ORDER_ID]);
  assert.equal(preparation.contractExecutionPlan.parameterCount, 1);
  assert.equal(preparation.contractExecutionPlan.feeLevel, "LOW");
  assert.deepEqual(preparation.expectedStateTransition, releasePlan.expectedStateTransition);
});

test("operator bridge preserves exact ABI signatures and parameter ordering", () => {
  const create = prepare(createPlan).contractExecutionPlan;
  const release = prepare(releasePlan).contractExecutionPlan;

  assert.equal(create.functionSignature, createPlan.abiFunctionSignature);
  assert.equal(release.functionSignature, releasePlan.abiFunctionSignature);
  assert.deepEqual(create.parameters, [
    createPlan.abiParameters[0],
    createPlan.abiParameters[1],
    createPlan.abiParameters[2].toString(),
    createPlan.abiParameters[3].toString(),
    createPlan.abiParameters[4].toString(),
    createPlan.abiParameters[5],
    createPlan.abiParameters[6],
    createPlan.abiParameters[7],
  ]);
  assert.deepEqual(release.parameters, releasePlan.abiParameters);
});

test("operator bridge rejects buyer approve and fund plans", () => {
  assert.throws(() => prepare(createApproveUsdcPlan({ order: createdOrder })), /operator signer/);
  assert.throws(() => prepare(createFundOrderPlan({ order: createdOrder })), /operator signer/);
});

test("operator bridge rejects a non-operator signer on an otherwise supported plan", () => {
  const forged = {
    ...createPlan,
    expectedSigner: { kind: MarketplaceSignerKind.Buyer, address: BUYER },
  } as unknown as MarketplaceCommandPlan;

  assert.throws(() => prepare(forged), /operator signer/);
});

test("operator bridge rejects a non-canonical contract target", () => {
  const forged = { ...createPlan, targetAddress: WRONG_TARGET } as MarketplaceCommandPlan;
  assert.throws(() => prepare(forged), /canonical SettlementEscrow target/);
});

test("operator bridge rejects a non-canonical ABI signature", () => {
  const forged = { ...createPlan, abiFunctionSignature: "createOrder(bytes32)" } as unknown as MarketplaceCommandPlan;
  assert.throws(() => prepare(forged), /ABI signature is not canonical/);
});

test("operator bridge requires both product operator and Circle wallet identity to match", () => {
  assert.throws(
    () => prepareOperatorSettlementExecution({
      plan: createPlan,
      configuredWalletAddress: OPERATOR,
      configuredOperatorAddress: OTHER_OPERATOR,
    }),
    /product operator address/,
  );
  assert.throws(
    () => prepareOperatorSettlementExecution({
      plan: createPlan,
      configuredWalletAddress: OTHER_OPERATOR,
      configuredOperatorAddress: OPERATOR,
    }),
    /Circle wallet address/,
  );
});

test("product dry-run reports plan details without constructing mutation dependencies", async () => {
  let constructed = 0;
  const output = await runOperatorSettlementExecution({
    plan: createPlan,
    configuredWalletAddress: OPERATOR,
    configuredOperatorAddress: OPERATOR,
    configuredWalletId: WALLET_ID,
    createExecutionDependencies() {
      constructed += 1;
      throw new Error("must not construct");
    },
  });

  assert.equal(constructed, 0);
  const summary = output.join("\n");
  assert.match(summary, /dry run; no Circle mutation/);
  assert.match(summary, /operation: create-order/);
  assert.match(summary, new RegExp(`operator signer: ${OPERATOR}`));
  assert.match(summary, new RegExp(`contract: ${ARC_TESTNET.settlementEscrow.address}`));
  assert.match(summary, /parameter count: 8/);
  assert.match(summary, /expected state transition: settlement-escrow None -> Created/);
});

test("operator execution reuses the UUID gate and exact existing SDK request builder", async () => {
  let constructed = 0;
  await assert.rejects(
    () => runOperatorSettlementExecution({
      plan: releasePlan,
      configuredWalletAddress: OPERATOR,
      configuredOperatorAddress: OPERATOR,
      configuredWalletId: WALLET_ID,
      execute: true,
      createExecutionDependencies() {
        constructed += 1;
        throw new Error("must not construct");
      },
    }),
    (error: unknown) => error instanceof CircleMutationRejectedError && /idempotency-key is required/.test(error.message),
  );
  assert.equal(constructed, 0);

  let request: CreateContractExecutionTransactionInput | undefined;
  const mutationGateway: WalletContractExecutionGateway = {
    async submit(input) {
      request = input;
      return { transactionId: TRANSACTION_ID, state: "INITIATED" };
    },
  };
  await runOperatorSettlementExecution({
    plan: releasePlan,
    configuredWalletAddress: OPERATOR,
    configuredOperatorAddress: OPERATOR,
    configuredWalletId: WALLET_ID,
    execute: true,
    idempotencyKey: IDEMPOTENCY_KEY,
    createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
  });

  assert.deepEqual(request, {
    walletId: WALLET_ID,
    contractAddress: ARC_TESTNET.settlementEscrow.address,
    abiFunctionSignature: MARKETPLACE_COMMAND_ABI_SIGNATURES.releaseOrder,
    abiParameters: [ORDER_ID],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    idempotencyKey: IDEMPOTENCY_KEY,
  });
});

test("operator execution reuses one-shot submission and never retries ambiguous failure", async () => {
  let calls = 0;
  const mutationGateway: WalletContractExecutionGateway = {
    async submit() {
      calls += 1;
      throw new Error("timeout");
    },
  };

  await assert.rejects(
    () => runOperatorSettlementExecution({
      plan: createPlan,
      configuredWalletAddress: OPERATOR,
      configuredOperatorAddress: OPERATOR,
      configuredWalletId: WALLET_ID,
      execute: true,
      idempotencyKey: IDEMPOTENCY_KEY,
      createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
    }),
    (error: unknown) => error instanceof CircleMutationAmbiguousError && /SAME idempotency key/.test(error.message),
  );
  assert.equal(calls, 1);
});

function prepare(plan: MarketplaceCommandPlan) {
  return prepareOperatorSettlementExecution({
    plan,
    configuredWalletAddress: OPERATOR,
    configuredOperatorAddress: OPERATOR,
  });
}

function preflightGateway() {
  return { async getWallet() { return wallet; } };
}