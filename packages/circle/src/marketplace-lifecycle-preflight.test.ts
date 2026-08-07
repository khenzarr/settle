import assert from "node:assert/strict";
import test from "node:test";

import { ARC_TESTNET, ZERO_BYTES32, type SettlementEscrowReader } from "@settle/shared";

import {
  createMarketplacePreflightRpcTransport,
  deriveMarketplaceOrderId,
  deriveMarketplaceTermsHash,
  normalizeMarketplaceLifecycleInput,
  preflightMarketplaceLifecycle,
  type MarketplaceArcReadGateway,
  type MarketplaceLifecyclePreflightArguments,
} from "./marketplace-lifecycle-preflight.ts";

const OPERATOR = "0x0000000000000000000000000000000000000001";
const BUYER = "0x0000000000000000000000000000000000000002";
const RECIPIENT_A = "0x0000000000000000000000000000000000000003";
const RECIPIENT_B = "0x0000000000000000000000000000000000000004";
const NOW = 1_700_000_000n;

const arguments_: MarketplaceLifecyclePreflightArguments = {
  runId: "demo-run-001",
  buyer: BUYER,
  recipientA: RECIPIENT_A,
  recipientABps: 3_333,
  recipientB: RECIPIENT_B,
  recipientBBps: 6_667,
  amountUsdc: "10.000001",
};

interface State {
  chainId: bigint;
  runtime: string;
  paused: boolean;
  token: string;
  operatorRole: boolean;
  orderExists: boolean;
  allowance: bigint;
  buyerUsdc: bigint;
  buyerNative: bigint;
  totalActiveEscrow: bigint;
  recipientAUsdc: bigint;
  recipientBUsdc: bigint;
}

const readyState: State = {
  chainId: BigInt(ARC_TESTNET.chainId),
  runtime: "0x6000",
  paused: false,
  token: ARC_TESTNET.usdc.address,
  operatorRole: true,
  orderExists: false,
  allowance: 0n,
  buyerUsdc: 10_000_001n,
  buyerNative: 1n,
  totalActiveEscrow: 25_000_000n,
  recipientAUsdc: 1_000_000n,
  recipientBUsdc: 2_000_000n,
};

test("orderId and termsHash are deterministic, nonzero, and normalize equivalent inputs", () => {
  const first = normalizeMarketplaceLifecycleInput(arguments_);
  const second = normalizeMarketplaceLifecycleInput({
    ...arguments_,
    runId: " demo-run-001 ",
    buyer: BUYER.toUpperCase().replace("0X", "0x"),
    recipientA: RECIPIENT_A.toUpperCase().replace("0X", "0x"),
    recipientB: RECIPIENT_B.toUpperCase().replace("0X", "0x"),
    amountUsdc: "10.000001",
  });

  assert.equal(deriveMarketplaceOrderId(arguments_.runId), deriveMarketplaceOrderId(" demo-run-001 "));
  assert.notEqual(deriveMarketplaceOrderId(arguments_.runId), ZERO_BYTES32);
  assert.equal(deriveMarketplaceTermsHash(first), deriveMarketplaceTermsHash(second));
  assert.notEqual(deriveMarketplaceTermsHash(first), ZERO_BYTES32);
});

test("manifest calculates two payouts with the final recipient receiving integer remainder", async () => {
  const manifest = await run();

  assert.deepEqual(manifest.recipients.map((recipient) => recipient.expectedPayoutBaseUnits), ["3333000", "6667001"]);
  assert.equal(manifest.recipients.reduce((sum, recipient) => sum + BigInt(recipient.expectedPayoutBaseUnits), 0n), 10_000_001n);
  assert.deepEqual(manifest.deadlines, { funding: "1700007200", settlement: "1700086400" });
  assert.equal(manifest.readiness.status, "READY");
});

test("zero allowance is allowed and nonzero allowance is reported as pre-step state", async () => {
  assert.equal((await run()).currentState.allowanceBaseUnits, "0");
  assert.equal((await run({ allowance: 2_500_000n })).currentState.allowanceBaseUnits, "2500000");
  assert.equal((await run({ allowance: 2_500_000n })).readiness.status, "READY");
});

test("all four lifecycle products are composed into publication-safe preparations", async () => {
  const manifest = await run();

  assert.equal(manifest.preparations.createOperator?.operation, "create-order");
  assert.equal(manifest.preparations.createOperator?.parameterCount, 8);
  assert.equal(manifest.preparations.approveBuyer?.operation, "approve-usdc");
  assert.equal(manifest.preparations.fundBuyer?.operation, "fund-order");
  assert.equal(manifest.preparations.releaseOperator?.operation, "release-order");
  assert.equal(manifest.preparations.releaseOperator?.parameterCount, 1);
});

for (const scenario of [
  { name: "existing order", patch: { orderExists: true }, reason: "ORDER_ID_ALREADY_EXISTS" },
  { name: "paused contract", patch: { paused: true }, reason: "SETTLEMENT_ESCROW_PAUSED" },
  { name: "wrong chain", patch: { chainId: 1n }, reason: "WRONG_CHAIN" },
  { name: "wrong token", patch: { token: RECIPIENT_A }, reason: "WRONG_SETTLEMENT_TOKEN" },
  { name: "missing operator role", patch: { operatorRole: false }, reason: "OPERATOR_ROLE_MISSING" },
  { name: "insufficient buyer USDC", patch: { buyerUsdc: 10_000_000n }, reason: "BUYER_USDC_INSUFFICIENT" },
  { name: "zero native buyer balance", patch: { buyerNative: 0n }, reason: "BUYER_NATIVE_BALANCE_ZERO" },
] as const) {
  test(`${scenario.name} is NOT READY`, async () => {
    const manifest = await run(scenario.patch);
    assert.equal(manifest.readiness.status, "NOT READY");
    assert.ok(manifest.readiness.reasons.includes(scenario.reason));
  });
}

test("RPC transport permits only the bounded read-only method set", async () => {
  const methods: string[] = [];
  const fetcher = (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { method: string };
    methods.push(body.method);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1" }), { status: 200 });
  }) as typeof globalThis.fetch;
  const transport = createMarketplacePreflightRpcTransport("https://rpc.example.test", fetcher);

  await transport.request("eth_chainId", []);
  await transport.request("eth_getCode", [ARC_TESTNET.settlementEscrow.address, "latest"]);
  await transport.request("eth_getBalance", [BUYER, "latest"]);
  await transport.request("eth_call", [{ to: ARC_TESTNET.settlementEscrow.address, data: "0x" }, "latest"]);
  assert.deepEqual(methods, ["eth_chainId", "eth_getCode", "eth_getBalance", "eth_call"]);
  await assert.rejects(() => (transport.request as (method: string, params: readonly unknown[]) => Promise<unknown>)("eth_sendRawTransaction", []), /refuses RPC method/);
  assert.equal(methods.length, 4);
});

async function run(patch: Partial<State> = {}) {
  const state = { ...readyState, ...patch };
  const settlementReader: SettlementEscrowReader = {
    async readSettlementOrder(orderId) {
      return state.orderExists
        ? { kind: "known", orderId: orderId as `0x${string}`, exists: true, order: {} as never }
        : { kind: "unknown", orderId: orderId as `0x${string}`, exists: false };
    },
    async readSettlementSplits() { throw new Error("not used"); },
    async readTotalActiveEscrow() { return state.totalActiveEscrow; },
    async readUsdcBalance(account = ARC_TESTNET.settlementEscrow.address) {
      const normalized = account.toLowerCase();
      if (normalized === BUYER) return state.buyerUsdc;
      if (normalized === RECIPIENT_A) return state.recipientAUsdc;
      if (normalized === RECIPIENT_B) return state.recipientBUsdc;
      throw new Error(`unexpected balance account ${account}`);
    },
    async readUsdcAllowance() { return state.allowance; },
    async readSettlementOrderProjection() { throw new Error("not used"); },
  };
  const arcReader: MarketplaceArcReadGateway = {
    async readChainId() { return state.chainId; },
    async readRuntimeCode() { return state.runtime; },
    async readPaused() { return state.paused; },
    async readSettlementToken() { return state.token.toLowerCase() as `0x${string}`; },
    async readOperatorRole() { return state.operatorRole; },
    async readNativeBalance() { return state.buyerNative; },
    async readAllowance() { return state.allowance; },
  };
  return preflightMarketplaceLifecycle({
    arguments: arguments_,
    operatorAddress: OPERATOR,
    circleWalletAddress: OPERATOR,
    dependencies: { settlementReader, arcReader, now: () => NOW },
  });
}