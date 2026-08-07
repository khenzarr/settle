import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { CircleDeploymentConfig } from "./config.ts";
import { createCanonicalDeploymentRequest, createPublicationSafeDeploymentSummary, deriveConstructorSignature, prepareSettlementEscrowDeployment } from "./contracts.ts";

const config: CircleDeploymentConfig = {
  deployerWalletId: "wallet-id",
  deployerAddress: "0x1111111111111111111111111111111111111111",
  administratorAddress: "0x2222222222222222222222222222222222222222",
  operatorAddress: "0x3333333333333333333333333333333333333333",
  arbitratorAddress: "0x4444444444444444444444444444444444444444",
  pauserAddress: "0x5555555555555555555555555555555555555555",
};

test("constructor parameter order exactly matches Solidity", async () => {
    const preparation = await prepareSettlementEscrowDeployment(config);
    assert.deepEqual(preparation.constructorParameters, [
      "0x3600000000000000000000000000000000000000",
      config.administratorAddress,
      config.operatorAddress,
      config.arbitratorAddress,
      config.pauserAddress,
    ]);
});

test("constructor signature is derived from ABI input types", async () => {
  const preparation = await prepareSettlementEscrowDeployment(config);
  assert.equal(preparation.constructorSignature, "constructor(address,address,address,address,address)");
  assert.equal(deriveConstructorSignature(preparation.abi), preparation.constructorSignature);
});

test("canonical deployment request contains the exact SDK payload", async () => {
  const preparation = await prepareSettlementEscrowDeployment(config);
  const request = createCanonicalDeploymentRequest(preparation);
  assert.equal(request.name, "SettlementEscrow");
  assert.equal(request.blockchain, "ARC-TESTNET");
  assert.equal(request.walletId, config.deployerWalletId);
  assert.deepEqual(request.constructorParameters, preparation.constructorParameters);
  assert.deepEqual(request.fee, { type: "level", config: { feeLevel: "MEDIUM" } });
  assert.deepEqual(JSON.parse(request.abiJson), preparation.abi);
  assert.match(request.bytecode, /^0x[0-9a-f]+$/i);
});

test("missing artifact is rejected", async () => {
  await assert.rejects(() => prepareSettlementEscrowDeployment(config, join(tmpdir(), "missing-settle-artifact.json")), /artifact is missing/);
});

test("empty bytecode is rejected", async () => {
  await withArtifact({ abi: [{ type: "constructor" }], bytecode: { object: "0x" } }, async (path) => {
    await assert.rejects(() => prepareSettlementEscrowDeployment(config, path), /bytecode must be non-empty/);
  });
});

test("deployment summary is publication safe", async () => {
    const summary = createPublicationSafeDeploymentSummary(await prepareSettlementEscrowDeployment(config));
    assert.equal(summary.bytecodeLength, 16359);
    assert.equal(summary.abiEntryCount, 70);
    assert.equal("bytecode" in summary, false);
    assert.equal("abi" in summary, false);
    assert.deepEqual(Object.keys(summary), [
      "contractName",
      "blockchain",
      "deployerWalletId",
      "deployerAddress",
      "bytecodeLength",
      "abiEntryCount",
      "officialUsdcAddress",
      "constructorRoles",
    ]);
});

async function withArtifact(value: unknown, action: (path: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "settle-circle-test-"));
  const path = join(directory, "SettlementEscrow.json");
  try {
    await writeFile(path, JSON.stringify(value), "utf8");
    await action(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}