import assert from "node:assert/strict";
import test from "node:test";

import { ARC_TESTNET, SettlementReadError, createHttpSettlementRpcTransport, type SettlementRpcTransport } from "@settle/shared";
import { encodeFunctionResult } from "viem";

import { DEMO_READINESS_RPC_METHODS, formatDemoReadinessReport, inspectDemoReadiness } from "./demo-readiness.ts";
import { createPaymentHandoff } from "./payment-handoff-service.server.ts";
import type { PaymentIntentView } from "@settle/shared";

function transport(overrides: Partial<Record<(typeof DEMO_READINESS_RPC_METHODS)[number], unknown | Error>> = {}): SettlementRpcTransport {
  const order = {
    buyer: "0x1111111111111111111111111111111111111111",
    totalAmount: 50_000n,
    fundingDeadline: 1n,
    settlementDeadline: 2n,
    termsHash: `0x${"22".repeat(32)}`,
    createdAt: 1n,
    fundedAt: 2n,
    disputedAt: 0n,
    settledAt: 3n,
    refundedAt: 0n,
    cancelledAt: 0n,
    status: 4,
  } as const;
  const calls = [
    encodeFunctionResult({ abi: [{ type: "function", name: "orderExists", inputs: [{ type: "bytes32" }], outputs: [{ type: "bool" }], stateMutability: "view" }], functionName: "orderExists", result: true }),
    encodeFunctionResult({ abi: [{ type: "function", name: "getOrder", inputs: [{ type: "bytes32" }], outputs: [{ type: "tuple", components: [{ name: "buyer", type: "address" }, { name: "totalAmount", type: "uint256" }, { name: "fundingDeadline", type: "uint256" }, { name: "settlementDeadline", type: "uint256" }, { name: "termsHash", type: "bytes32" }, { name: "createdAt", type: "uint256" }, { name: "fundedAt", type: "uint256" }, { name: "disputedAt", type: "uint256" }, { name: "settledAt", type: "uint256" }, { name: "refundedAt", type: "uint256" }, { name: "cancelledAt", type: "uint256" }, { name: "status", type: "uint8" }] }], stateMutability: "view" }], functionName: "getOrder", result: order }),
    encodeFunctionResult({ abi: [{ type: "function", name: "getSettlementSplits", inputs: [{ type: "bytes32" }], outputs: [{ type: "address[]" }, { type: "uint16[]" }], stateMutability: "view" }], functionName: "getSettlementSplits", result: [["0x2222222222222222222222222222222222222222"], [10_000]] }),
  ];
  return {
    async request(method) {
      const override = overrides[method as keyof typeof overrides];
      if (override instanceof Error) throw override;
      if (override !== undefined) return override;
      if (method === "eth_chainId") return `0x${ARC_TESTNET.chainId.toString(16)}`;
      if (method === "eth_getCode") return "0x6001";
      if (method === "eth_call") return calls.shift();
      if (method === "eth_blockNumber") return "0x3600000";
      if (method === "eth_getLogs") return [{}];
      throw new Error(`unexpected method ${method}`);
    },
  };
}

test("classifies core, evidence, and QR readiness independently", async (t) => {
  await t.test("full readiness passes", async () => {
    const report = await inspectDemoReadiness({ SETTLE_PUBLIC_APP_ORIGIN: "https://settle.example" }, { transport: transport(), production: true });
    assert.equal(report.overall, "PASS");
    assert.equal(report.corePaymentReadiness, "PASS");
  });
  await t.test("wrong chain is a blocker", async () => {
    const report = await inspectDemoReadiness({}, { transport: transport({ eth_chainId: "0x1" }) });
    assert.equal(report.chain, "FAIL");
    assert.equal(report.corePaymentReadiness, "BLOCKER");
  });
  await t.test("missing contract code is a blocker", async () => {
    const report = await inspectDemoReadiness({}, { transport: transport({ eth_getCode: "0x" }) });
    assert.equal(report.contractCode, "FAIL");
    assert.equal(report.overall, "BLOCKER");
  });
  await t.test("canonical failure is a blocker", async () => {
    const report = await inspectDemoReadiness({}, { transport: transport({ eth_call: new Error("offline") }) });
    assert.equal(report.canonicalRead, "FAIL");
    assert.equal(report.corePaymentReadiness, "BLOCKER");
  });
  await t.test("evidence failure is degraded while core and QR pass", async () => {
    const report = await inspectDemoReadiness({ SETTLE_PUBLIC_APP_ORIGIN: "https://settle.example" }, { transport: transport({ eth_getLogs: new Error("logs unavailable") }), production: true });
    assert.equal(report.corePaymentReadiness, "PASS");
    assert.equal(report.lifecycleEvidence, "DEGRADED");
    assert.equal(report.qrReadiness, "PASS");
    assert.equal(report.overall, "DEGRADED");
  });
  await t.test("missing origin degrades QR only", async () => {
    const report = await inspectDemoReadiness({}, { transport: transport() });
    assert.equal(report.corePaymentReadiness, "PASS");
    assert.equal(report.qrReadiness, "DEGRADED");
    assert.equal(report.overall, "DEGRADED");
  });
});

test("readiness output reports sources without publishing configuration values", async () => {
  const secretRpc = "https://user:credential@rpc.example.test/private";
  const secret = "circle-secret-value";
  const report = await inspectDemoReadiness({ ARC_TESTNET_RPC_URL: secretRpc, CIRCLE_API_KEY: secret }, { transport: transport() });
  const output = formatDemoReadinessReport(report);
  assert.match(output, /RPC source: configured override/);
  assert.doesNotMatch(output, /rpc\.example|credential|circle-secret-value|CIRCLE_API_KEY/);
});

test("diagnostic transport permits only the documented read methods", async () => {
  const methods: string[] = [];
  const rpc = createHttpSettlementRpcTransport("https://rpc.example.test", async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { method: string };
    methods.push(body.method);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1" }), { status: 200 });
  });
  for (const method of DEMO_READINESS_RPC_METHODS) await rpc.request(method, []);
  await assert.rejects(rpc.request("eth_sendTransaction", []), (error: unknown) => error instanceof SettlementReadError && error.code === "INVALID_CONFIGURATION");
  await assert.rejects(rpc.request("eth_sendRawTransaction", []), (error: unknown) => error instanceof SettlementReadError && error.code === "INVALID_CONFIGURATION");
  assert.deepEqual(methods, DEMO_READINESS_RPC_METHODS);
});

test("public origin creates the exact demo checkout and QR payload without transfer syntax", () => {
  const intent = {
    orderId: "0x221c314b3d80445868b1aeec7f5ebdbaf50fd48c320245659b689b7a4fca1765",
    source: "onchain",
    buyer: "0x1111111111111111111111111111111111111111",
    amount: { baseUnits: "50000", usdc: "0.05" },
    network: { environment: "arc-testnet", blockchain: "Arc Testnet", chainId: 5042002, usdcAddress: ARC_TESTNET.usdc.address, settlementEscrowAddress: ARC_TESTNET.settlementEscrow.address },
    canonicalStatus: "Completed",
    paymentState: "completed",
    paymentActionAvailable: false,
    checkoutPath: "/pay/0x221c314b3d80445868b1aeec7f5ebdbaf50fd48c320245659b689b7a4fca1765",
    checkout: {
      pageAvailable: true,
      path: "/pay/0x221c314b3d80445868b1aeec7f5ebdbaf50fd48c320245659b689b7a4fca1765",
      paymentActionAvailable: false,
    },
    evidence: { completeness: "partial", lifecycle: [], payouts: [], warnings: [] },
  } as unknown as PaymentIntentView;
  const handoff = createPaymentHandoff(intent, { SETTLE_PUBLIC_APP_ORIGIN: "https://settle.example" });
  const expected = `https://settle.example/pay/${intent.orderId}`;
  assert.equal(handoff.checkout.url, expected);
  assert.equal(handoff.qr.payload, expected);
  assert.equal(new URL(handoff.qr.payload).host, "settle.example");
  assert.equal(new URL(handoff.qr.payload).pathname, `/pay/${intent.orderId}`);
  assert.doesNotMatch(handoff.qr.payload, /transfer|calldata|recipient=|0x3600000000000000000000000000000000000000/);
});
