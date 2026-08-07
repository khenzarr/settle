import assert from "node:assert/strict";
import { test } from "node:test";
import type { BuyerTransactionIntent } from "@settle/shared";
import { ARC_TESTNET_CHAIN_ID_HEX, submitBuyerTransaction, switchToArcTestnet, type Eip1193Provider } from "./buyer-wallet-adapter.ts";

const from = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const intent = (overrides: Partial<BuyerTransactionIntent> = {}): BuyerTransactionIntent => ({
  operation: "approve-usdc", chainId: 5042002, from, to: "0x2222222222222222222222222222222222222222", data: "0x1234", value: 0n,
  expectedSigner: { kind: "buyer", address: from }, summary: "prepared", prerequisites: [], ...overrides,
});
function provider(results: Record<string, unknown>, calls: { method: string; params?: readonly unknown[] }[] = []): Eip1193Provider {
  return { request: async (args) => { calls.push(args); const result = results[args.method]; if (result instanceof Error) throw result; return result; } };
}

test("submits exact buyer request and returns hash without finality", async () => {
  const calls: { method: string; params?: readonly unknown[] }[] = [];
  const result = await submitBuyerTransaction(intent(), provider({ eth_chainId: ARC_TESTNET_CHAIN_ID_HEX, eth_accounts: [from], eth_sendTransaction: "0xhash" }, calls));
  assert.deepEqual(result, { hash: "0xhash", from, target: intent().to, operation: "approve-usdc" });
  assert.deepEqual(calls[2], { method: "eth_sendTransaction", params: [{ chainId: ARC_TESTNET_CHAIN_ID_HEX, from, to: intent().to, data: "0x1234", value: "0x0" }] });
  assert.equal("receipt" in result, false);
});

test("rejects wrong account, wrong chain, operator intent, and nonzero value", async () => {
  const base = { eth_chainId: ARC_TESTNET_CHAIN_ID_HEX, eth_accounts: [from], eth_sendTransaction: "0xhash" };
  await assert.rejects(submitBuyerTransaction(intent({ from: "0x3333333333333333333333333333333333333333" as `0x${string}` }), provider(base)), /account/);
  await assert.rejects(submitBuyerTransaction(intent(), provider({ ...base, eth_chainId: "0x1" })), /Arc Testnet/);
  await assert.rejects(submitBuyerTransaction(intent({ expectedSigner: { kind: "operator", address: from } as never }), provider(base)), /buyer/);
  await assert.rejects(submitBuyerTransaction(intent({ value: 1n as 0n }), provider(base)), /zero/);
});

test("preserves opaque calldata and propagates provider rejection", async () => {
  const calls: { method: string; params?: readonly unknown[] }[] = [];
  const error = new Error("user rejected");
  await assert.rejects(submitBuyerTransaction(intent({ data: "0xdeadbeef" }), provider({ eth_chainId: ARC_TESTNET_CHAIN_ID_HEX, eth_accounts: [from], eth_sendTransaction: error }, calls)), /user rejected/);
  assert.equal(calls.some((call) => call.method === "eth_call"), false);
});

test("adds and switches Arc Testnet only when wallet reports 4902", async () => {
  const calls: { method: string; params?: readonly unknown[] }[] = [];
  let chain = "0x1";
  const mock: Eip1193Provider = { request: async (args) => {
    calls.push(args);
    if (args.method === "wallet_switchEthereumChain" && calls.filter((c) => c.method === args.method).length === 1) throw Object.assign(new Error("unknown"), { code: 4902 });
    if (args.method === "eth_chainId") return chain;
    if (args.method === "eth_accounts") return [from];
    if (args.method === "wallet_addEthereumChain") { chain = ARC_TESTNET_CHAIN_ID_HEX; return null; }
    return null;
  } };
  await switchToArcTestnet(mock);
  assert.deepEqual(calls.map((call) => call.method), ["wallet_switchEthereumChain", "wallet_addEthereumChain", "wallet_switchEthereumChain", "eth_chainId", "eth_accounts"]);
});