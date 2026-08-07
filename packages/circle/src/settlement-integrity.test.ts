import assert from "node:assert/strict";
import test from "node:test";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { ARC_TESTNET } from "@settle/shared";
import type { EvmAddress } from "@settle/shared";
import { checkSettlementIntegrity, formatSettlementIntegrityReport, parseSettlementIntegrityConfig } from "./settlement-integrity.ts";

const addresses = {
  contract: "0x1111111111111111111111111111111111111111" as EvmAddress,
  administrator: "0x2222222222222222222222222222222222222222" as EvmAddress,
  operator: "0x3333333333333333333333333333333333333333" as EvmAddress,
  arbitrator: "0x4444444444444444444444444444444444444444" as EvmAddress,
  pauser: "0x5555555555555555555555555555555555555555" as EvmAddress,
};
const config = {
  contractAddress: addresses.contract,
  administratorAddress: addresses.administrator,
  operatorAddress: addresses.operator,
  arbitratorAddress: addresses.arbitrator,
  pauserAddress: addresses.pauser,
  rpcUrl: "https://rpc.testnet.arc.network",
} as const;
const artifact = { object: "0x6001", immutableReferences: {}, linkReferences: {} } as const;
const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;
const addressWord = (value: string) => `0x${value.slice(2).padStart(64, "0")}`;
const hashWord = (value: string) => `0x${Array.from(keccak_256(new TextEncoder().encode(value)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;

interface Scenario {
  chainId?: string;
  code?: string;
  usdc?: string;
  decimals?: bigint;
  roles?: readonly boolean[];
  paused?: boolean;
  total?: bigint;
  rpcFailureAt?: number;
}

function mockRpc(scenario: Scenario = {}) {
  const roleValues = [word(0n), hashWord("OPERATOR_ROLE"), hashWord("ARBITRATOR_ROLE"), hashWord("PAUSER_ROLE")];
  const roleChecks = scenario.roles ?? [true, true, true, true];
  const results: unknown[] = [
    scenario.chainId ?? `0x${ARC_TESTNET.chainId.toString(16)}`,
    scenario.code ?? artifact.object,
    addressWord(scenario.usdc ?? ARC_TESTNET.usdc.address),
    word(scenario.decimals ?? 6n),
    ...roleValues.flatMap((role, index) => [role, word(roleChecks[index] ? 1n : 0n)]),
    word(scenario.paused ? 1n : 0n),
    word(scenario.total ?? 0n),
  ];
  const requests: Record<string, unknown>[] = [];
  const fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push(request);
    if (scenario.rpcFailureAt === requests.length) throw new Error("secret upstream detail api-key-value");
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: results.shift() }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
  return { fetch, requests };
}

async function run(scenario: Scenario = {}) {
  const rpc = mockRpc(scenario);
  return { report: await checkSettlementIntegrity({ config, fetch: rpc.fetch, artifact }), requests: rpc.requests };
}

test("correct Arc chain and zero initial escrow succeed", async () => {
  const { report } = await run();
  assert.equal(report.chainId, ARC_TESTNET.chainId);
  assert.equal(report.totalActiveEscrow, 0n);
  assert.equal(report.runtimeIntegrity, "exact match after immutable substitution");
});

const failures: readonly [string, Scenario, RegExp][] = [
  ["wrong chain fails", { chainId: "0x1" }, /Expected Arc Testnet chain ID/],
  ["empty contract bytecode fails", { code: "0x" }, /empty deployed runtime bytecode/],
  ["wrong USDC address fails", { usdc: addresses.operator }, /Settlement token mismatch/],
  ["non-6-decimal token fails", { decimals: 18n }, /token decimals mismatch/],
  ["missing admin role fails", { roles: [false, true, true, true] }, /administrator address/],
  ["missing operator role fails", { roles: [true, false, true, true] }, /operator address/],
  ["missing arbitrator role fails", { roles: [true, true, false, true] }, /arbitrator address/],
  ["missing pauser role fails", { roles: [true, true, true, false] }, /pauser address/],
  ["paused deployment fails", { paused: true }, /deployment is paused/],
  ["unexpected active escrow fails", { total: 1n }, /Expected zero initial totalActiveEscrow, received 1/],
];
for (const [name, scenario, expected] of failures) {
  test(name, async () => assert.rejects(() => run(scenario), expected));
}

test("malformed and zero contract addresses fail before RPC", () => {
  for (const value of ["not-an-address", "0x0000000000000000000000000000000000000000"]) {
    assert.throws(() => parseSettlementIntegrityConfig(environment(value)), /address|non-zero/i);
  }
});

test("successful report excludes sensitive configuration", async () => {
  const output = formatSettlementIntegrityReport((await run()).report);
  assert.match(output, /contract address:/);
  assert.doesNotMatch(output, /api-key-value|entity-secret|wallet-set|circle-wallet|idempotency/i);
  assert.equal(output.includes(config.rpcUrl), false);
});

test("RPC failures use bounded diagnostics", async () => {
  await assert.rejects(() => run({ rpcFailureAt: 1 }), (error: unknown) => {
    assert.match(String(error), /^TypeError: Arc Testnet RPC eth_chainId request failed$/);
    assert.doesNotMatch(String(error), /secret upstream detail|api-key-value/);
    return true;
  });
});

test("checker uses no write-capable RPC methods", async () => {
  const { requests } = await run();
  const methods = requests.map((request) => request.method);
  assert.deepEqual(new Set(methods), new Set(["eth_chainId", "eth_getCode", "eth_call"]));
  assert.equal(methods.some((method) => typeof method === "string" && /send|sign|estimate|transaction/i.test(method)), false);
});

function environment(contractAddress: string): Record<string, string> {
  return {
    ARC_TESTNET_RPC_URL: config.rpcUrl,
    SETTLEMENT_CONTRACT_ADDRESS: contractAddress,
    SETTLE_ADMIN_ADDRESS: addresses.administrator,
    SETTLE_OPERATOR_ADDRESS: addresses.operator,
    SETTLE_ARBITRATOR_ADDRESS: addresses.arbitrator,
    SETTLE_PAUSER_ADDRESS: addresses.pauser,
  };
}