import assert from "node:assert/strict";
import test from "node:test";
import type { CircleDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import type { CircleSmartContractPlatformClient } from "@circle-fin/smart-contract-platform";
import { estimateDeployment, formatSafeFeeEstimate, getContractStatus, getTransactionStatus, parseDeploymentCommandArguments, runDeploymentCommand, submitDeployment } from "./contract-deployment.ts";
import type { CircleContractDeploymentPreparation } from "./contracts.ts";

const preparation: CircleContractDeploymentPreparation = {
  contractName: "SettlementEscrow", blockchain: "ARC-TESTNET", deployerWalletId: "wallet-id", deployerAddress: "0x1111111111111111111111111111111111111111",
  abi: [{ type: "constructor", inputs: Array.from({ length: 5 }, () => ({ type: "address" })) }], bytecode: "0x6001",
  constructorSignature: "constructor(address,address,address,address,address)", constructorParameters: ["0x3600000000000000000000000000000000000000", "0x2222222222222222222222222222222222222222", "0x3333333333333333333333333333333333333333", "0x4444444444444444444444444444444444444444", "0x5555555555555555555555555555555555555555"],
};

test("estimate uses the signature-exclusive SDK request and returns available safe medium fee fields", async () => {
  let request: unknown;
  const client = { async estimateContractDeploymentFee(input: unknown) { request = input; return { data: { medium: { gasLimit: "1", baseFee: "2", priorityFee: "3", maxFee: "4", gasPrice: "5", networkFee: "6", networkFeeRaw: "7", l1Fee: "8" } } }; } } as unknown as CircleSmartContractPlatformClient;
  const result = await estimateDeployment({ client, preparation });
  assert.deepEqual(request, { walletId: preparation.deployerWalletId, bytecode: "0x6001", constructorSignature: preparation.constructorSignature, constructorParameters: [...preparation.constructorParameters] });
  assert.deepEqual(Object.keys(request as object), ["walletId", "bytecode", "constructorSignature", "constructorParameters"]);
  assert.equal(Object.hasOwn(request as object, "abiJson"), false);
  assert.equal(Object.hasOwn(request as object, "blockchain"), false);
  assert.equal(Object.hasOwn(request as object, "sourceAddress"), false);
  assert.deepEqual(result, { blockchain: "ARC-TESTNET", sourceWalletAddress: preparation.deployerAddress, feeLevel: "MEDIUM", gasLimit: "1", baseFee: "2", priorityFee: "3", maxFee: "4", gasPrice: "5", networkFee: "6", networkFeeRaw: "7", l1Fee: "8" });
  assert.ok(Object.hasOwn(preparation, "abi"));
  assert.equal(JSON.stringify(result).includes("bytecode"), false);
  assert.equal(JSON.stringify(result).includes("constructor"), false);
  const output = formatSafeFeeEstimate({ ...result, requestId: "request-id" }).join("\n");
  assert.match(output, /requestId: request-id/);
  assert.doesNotMatch(output, /0x6001|constructor|abiJson|bytecode/i);
});

test("estimate accepts missing optional network fee fields and prints them only when present", async () => {
  const client = { async estimateContractDeploymentFee() { return { data: { medium: { gasLimit: "1", baseFee: "2", priorityFee: "3", maxFee: "4" } } }; } } as unknown as CircleSmartContractPlatformClient;
  const result = await estimateDeployment({ client, preparation });
  assert.equal(Object.hasOwn(result, "networkFee"), false);
  assert.equal(Object.hasOwn(result, "networkFeeRaw"), false);
  const output = formatSafeFeeEstimate(result).join("\n");
  assert.match(output, /gasLimit: 1/);
  assert.match(output, /baseFee: 2/);
  assert.match(output, /priorityFee: 3/);
  assert.match(output, /maxFee: 4/);
  assert.doesNotMatch(output, /networkFee/);
});

test("deployment arguments require an explicit execution gate and UUIDv4 key", () => {
  assert.deepEqual(parseDeploymentCommandArguments([]), { execute: false });
  assert.throws(() => parseDeploymentCommandArguments(["--idempotency-key", "11111111-1111-4111-8111-111111111111"]), /--execute is required/);
  assert.throws(() => parseDeploymentCommandArguments(["--execute"]), /--idempotency-key is required/);
  assert.throws(() => parseDeploymentCommandArguments(["--execute", "--idempotency-key", "bad"]));
  assert.throws(() => parseDeploymentCommandArguments(["--execute", "--idempotency-key", "11111111-1111-5111-8111-111111111111"]), /UUIDv4/);
  assert.throws(() => parseDeploymentCommandArguments(["--unknown"]), /Unsupported argument/);
});

test("dry-run deployment prints a safe plan and performs no Circle operation", async () => {
  let preflightCalls = 0;
  let mutationCalls = 0;
  const output = await runDeploymentCommand({
    args: [], preparation,
    preflight: async () => { preflightCalls++; throw new Error("must not run"); },
    submit: async () => { mutationCalls++; throw new Error("must not run"); },
  });
  assert.equal(preflightCalls, 0);
  assert.equal(mutationCalls, 0);
  assert.match(output.join("\n"), /dry run; no Circle mutation/);
  assert.doesNotMatch(output.join("\n"), /0x6001|constructor\(|\"type\":\"constructor\"/);
});

test("explicit execution preflights and submits exactly once", async () => {
  let preflightCalls = 0;
  let mutationCalls = 0;
  const output = await runDeploymentCommand({
    args: ["--execute", "--idempotency-key", "33333333-3333-4333-8333-333333333333"], preparation,
    preflight: async () => { preflightCalls++; return { walletSetId: "set", walletId: "wallet-id", address: preparation.deployerAddress, blockchain: "ARC-TESTNET", accountType: "EOA" }; },
    submit: async (request, key) => { mutationCalls++; assert.equal(request.fee.config.feeLevel, "MEDIUM"); assert.equal(key, "33333333-3333-4333-8333-333333333333"); return { contractId: "11111111-1111-4111-8111-111111111111", transactionId: "22222222-2222-4222-8222-222222222222" }; },
  });
  assert.equal(preflightCalls, 1);
  assert.equal(mutationCalls, 1);
  assert.match(output.join("\n"), /deployment state: initiated/);
  assert.doesNotMatch(output.join("\n"), /0x6001|constructor|abiJson|idempotency/i);
});

test("deploy submits one canonical SDK request and validates response IDs", async () => {
  let calls = 0, request: unknown;
  const client = { async deployContract(input: unknown) { calls++; request = input; return { data: { contractId: "11111111-1111-4111-8111-111111111111", transactionId: "22222222-2222-4222-8222-222222222222" } }; } } as unknown as CircleSmartContractPlatformClient;
  const canonical = { name: "SettlementEscrow" as const, description: "description", blockchain: "ARC-TESTNET" as const, walletId: "wallet-id", abiJson: "[]", bytecode: "0x6001", constructorParameters: preparation.constructorParameters, fee: { type: "level" as const, config: { feeLevel: "MEDIUM" as const } } };
  const result = await submitDeployment({ client, request: canonical, idempotencyKey: "33333333-3333-4333-8333-333333333333" });
  assert.equal(calls, 1);
  assert.deepEqual(request, { ...canonical, constructorParameters: [...canonical.constructorParameters], idempotencyKey: "33333333-3333-4333-8333-333333333333" });
  assert.deepEqual(Object.keys(request as object), ["name", "description", "blockchain", "walletId", "abiJson", "bytecode", "constructorParameters", "fee", "idempotencyKey"]);
  assert.equal(Object.hasOwn(request as object, "abiJson"), true);
  assert.equal(Object.hasOwn(request as object, "constructorSignature"), false);
  assert.deepEqual(result, { contractId: "11111111-1111-4111-8111-111111111111", transactionId: "22222222-2222-4222-8222-222222222222" });
  const bad = { async deployContract() { return { data: { contractId: "bad", transactionId: "bad" } }; } } as unknown as CircleSmartContractPlatformClient;
  await assert.rejects(() => submitDeployment({ client: bad, request: canonical, idempotencyKey: "33333333-3333-4333-8333-333333333333" }));
});

test("status gateways retrieve safe contract and transaction fields", async () => {
  const contractClient = { async getContract() { return { data: { contract: { id: "c", blockchain: "ARC-TESTNET", status: "COMPLETE", verificationStatus: "VERIFIED", archived: false, contractInputType: "BYTECODE", name: "SettlementEscrow", updateDate: "", createDate: "", sourceCode: [], functions: [], events: [] } } }; } } as unknown as CircleSmartContractPlatformClient;
  const transactionClient = { async getTransaction() { return { data: { transaction: { id: "t", blockchain: "ARC-TESTNET", state: "PENDING", transactionType: "CONTRACT_DEPLOYMENT", createDate: "", updateDate: "" } } }; } } as unknown as CircleDeveloperControlledWalletsClient;
  assert.equal((await getContractStatus(contractClient, "c")).status, "COMPLETE");
  assert.equal((await getTransactionStatus(transactionClient, "t")).state, "PENDING");
});