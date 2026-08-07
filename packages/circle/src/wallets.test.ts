import assert from "node:assert/strict";
import test from "node:test";
import type { CircleWalletGateway, CircleWalletRecord } from "./wallets.ts";
import { executeDeployerWalletPlan, planDeployerWallet, preflightDeployerWallet, validateArcTestnetWallet } from "./wallets.ts";

const validWallet: CircleWalletRecord = {
  id: "wallet-id",
  walletSetId: "wallet-set-id",
  address: "0x1111111111111111111111111111111111111111",
  blockchain: "ARC-TESTNET",
  accountType: "EOA",
};

const validMetadata = {
  walletSetId: "wallet-set-id",
  walletId: "wallet-id",
  address: "0x1111111111111111111111111111111111111111",
  blockchain: "ARC-TESTNET" as const,
  accountType: "EOA" as const,
};

test("valid Arc wallet metadata is publication safe", () => {
  assert.deepEqual(validateArcTestnetWallet({ ...validWallet, address: validWallet.address.toUpperCase().replace("0X", "0x") }), validMetadata);
});

test("wrong blockchain is rejected", () => {
  assert.throws(() => validateArcTestnetWallet({ ...validWallet, blockchain: "ETH-SEPOLIA" }), /ARC-TESTNET/);
});

test("zero wallet address is rejected", () => {
  assert.throws(() => validateArcTestnetWallet({ ...validWallet, address: `0x${"0".repeat(40)}` }), /Address cannot be zero/);
});

test("existing wallet-set reuse plan never plans wallet-set creation", () => {
  assert.deepEqual(planDeployerWallet({ execute: false, configuredWalletSetId: "existing-set" }).walletSet, {
    action: "reuse",
    id: "existing-set",
  });
});

test("existing wallet reuse plan never plans wallet creation", () => {
  assert.deepEqual(planDeployerWallet({ execute: false, configuredWalletId: "existing-wallet" }).wallet, {
    action: "reuse",
    id: "existing-wallet",
  });
});

test("dry-run wallet creation plan describes creation without a gateway", () => {
  assert.deepEqual(planDeployerWallet({ execute: false }), {
    mode: "dry-run",
    walletSet: { action: "create" },
    wallet: { action: "create" },
    blockchain: "ARC-TESTNET",
    accountType: "EOA",
  });
});

test("existing wallet execution calls only getWallet on the mocked Circle boundary", async () => {
  const calls: string[] = [];
  const gateway = fakeGateway(calls);
  const result = await executeDeployerWalletPlan({ gateway, configuredWalletSetId: "existing-set", configuredWalletId: "wallet-id" });
  assert.deepEqual(result, validMetadata);
  assert.deepEqual(calls, ["getWallet:wallet-id"]);
});

test("existing wallet-set execution creates only the missing wallet", async () => {
  const calls: string[] = [];
  const gateway = fakeGateway(calls);
  await executeDeployerWalletPlan({
    gateway,
    configuredWalletSetId: "wallet-set-id",
    walletIdempotencyKey: "wallet-key",
  });
  assert.deepEqual(calls, ["createWallet:wallet-set-id:wallet-key"]);
});

test("wallet preflight accepts matching live developer-controlled metadata", async () => {
  const gateway = fakeGateway([]);
  const result = await preflightDeployerWallet({ gateway: { ...gateway, async getWallet() { return { ...validWallet, custodyType: "DEVELOPER", state: "LIVE" }; } }, configuredWalletId: validWallet.id, configuredAddress: validWallet.address as `0x${string}` });
  assert.equal(result.state, "LIVE");
});

test("wallet preflight rejects ID and address mismatches", async () => {
  await assert.rejects(() => preflightDeployerWallet({ gateway: fakeGateway([]), configuredWalletId: "other", configuredAddress: validWallet.address as `0x${string}` }), /wallet ID/);
  await assert.rejects(() => preflightDeployerWallet({ gateway: fakeGateway([]), configuredWalletId: validWallet.id, configuredAddress: "0x2222222222222222222222222222222222222222" }), /wallet address/);
});

test("wallet validation rejects wrong account type and non-live state", async () => {
  assert.throws(() => validateArcTestnetWallet({ ...validWallet, accountType: "SCA" }), /EOA/);
  const gateway = { ...fakeGateway([]), async getWallet() { return { ...validWallet, state: "FROZEN" }; } };
  await assert.rejects(() => preflightDeployerWallet({ gateway, configuredWalletId: validWallet.id, configuredAddress: validWallet.address as `0x${string}` }), /LIVE/);
});

function fakeGateway(calls: string[]): CircleWalletGateway {
  return {
    async createWalletSet(input) {
      calls.push(`createWalletSet:${input.idempotencyKey}`);
      return { id: "wallet-set-id" };
    },
    async createWallet(input) {
      calls.push(`createWallet:${input.walletSetId}:${input.idempotencyKey}`);
      return validWallet;
    },
    async getWallet(walletId) {
      calls.push(`getWallet:${walletId}`);
      return validWallet;
    },
    async listWallets(walletSetId) {
      calls.push(`listWallets:${walletSetId ?? "all"}`);
      return [validWallet];
    },
  };
}