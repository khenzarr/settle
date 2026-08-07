import assert from "node:assert/strict";
import test from "node:test";
import type { CreateContractExecutionTransactionInput, CreateTransferTransactionInput } from "@circle-fin/developer-controlled-wallets";
import { CircleIntegrationError } from "./errors.ts";
import { CircleMutationAmbiguousError, CircleMutationRecoveryRequiredError, CircleMutationRejectedError, parseMutationExecutionGate, validateSubmissionResult } from "./wallet-mutations.ts";
import { parseWalletContractExecutionArguments, prepareWalletContractExecution, runWalletContractExecutionCommand } from "./wallet-contract-execution.ts";
import type { WalletContractExecutionGateway } from "./wallet-contract-execution.ts";
import { parseWalletTransferArguments, prepareWalletTransfer, runWalletTransferCommand } from "./wallet-transfer.ts";
import type { WalletTransferGateway } from "./wallet-transfer.ts";
import type { CircleWalletRecord } from "./wallets.ts";

const wallet: CircleWalletRecord = {
  id: "configured-wallet-id",
  walletSetId: "configured-wallet-set-id",
  address: "0x1111111111111111111111111111111111111111",
  blockchain: "ARC-TESTNET",
  accountType: "EOA",
  custodyType: "DEVELOPER",
  state: "LIVE",
};
const destination = "0x2222222222222222222222222222222222222222";
const contract = "0x3333333333333333333333333333333333333333";
const testUuidV4 = "123e4567-e89b-42d3-a456-426614174000";
const transactionId = "123e4567-e89b-42d3-a456-426614174001";
const transferDryArgs = ["--destination", destination, "--amount", "1.250000", "--token-address", "0x3600000000000000000000000000000000000000"];
const contractDryArgs = ["--contract", contract, "--function", "transfer(address,uint256)", "--parameters", `["${destination}","1000000"]`];

function preflightGateway() {
  return { async getWallet() { return wallet; } };
}

test("transfer defaults to dry-run and constructs no execution dependency", async () => {
  let constructed = 0;
  const output = await runWalletTransferCommand({
    args: transferDryArgs,
    sourceAddress: wallet.address,
    configuredWalletId: wallet.id,
    createExecutionDependencies() { constructed += 1; throw new Error("must not construct"); },
  });
  assert.equal(constructed, 0);
  const summary = output.join("\n");
  assert.match(summary, /dry run; no Circle mutation/);
  assert.match(summary, /blockchain: ARC-TESTNET/);
  assert.match(summary, new RegExp(`destination: ${destination}`));
  assert.match(summary, /token address 0x3600000000000000000000000000000000000000/);
  assert.match(summary, /amount: 1\.250000/);
  assert.match(summary, /fee policy: dynamic fee level MEDIUM/);
  assert.match(summary, /execution required: no/);
});

test("transfer accepts a valid destination and exact decimal amount", () => {
  const plan = prepareWalletTransfer({ args: parseWalletTransferArguments(transferDryArgs), sourceAddress: wallet.address });
  assert.equal(plan.destination, destination);
  assert.equal(plan.amount, "1.250000");
  assert.deepEqual(plan.token, { kind: "token-address", tokenAddress: "0x3600000000000000000000000000000000000000" });
});

for (const [name, value] of [
  ["zero destination", "0x0000000000000000000000000000000000000000"],
  ["malformed destination", "not-an-address"],
] as const) {
  test(`transfer rejects ${name}`, () => {
    assert.throws(() => parseAndPrepareTransfer(["--destination", value, "--amount", "1", "--token-id", "token-id"]), /destination.*non-zero|destination.*valid/i);
  });
}

for (const value of ["0", "0.0", "-1", "+1", "1e3", ".5", "1.", "01", "NaN"]) {
  test(`transfer rejects unsafe amount syntax ${value}`, () => {
    assert.throws(() => parseAndPrepareTransfer(["--destination", destination, "--amount", value, "--token-id", "token-id"]));
  });
}

test("transfer enforces exact SDK token reference alternatives", () => {
  assert.throws(() => parseWalletTransferArguments(["--destination", destination, "--amount", "1"]), /exactly one/);
  assert.throws(() => parseWalletTransferArguments([...transferDryArgs, "--token-id", "also-token"]), /exactly one/);
  assert.throws(() => parseAndPrepareTransfer(["--destination", destination, "--amount", "1", "--token-id", "bad token id"]), /token-id is malformed/);
  const plan = parseAndPrepareTransfer(["--destination", destination, "--amount", "1", "--token-id", "circle-token:123"]);
  assert.deepEqual(plan.token, { kind: "token-id", tokenId: "circle-token:123" });
});

test("transfer execution gate requires caller UUIDv4 and rejects key without execute", () => {
  assert.throws(() => parseWalletTransferArguments([...transferDryArgs, "--execute"]), /idempotency-key is required/);
  assert.throws(() => parseWalletTransferArguments([...transferDryArgs, "--execute", "--idempotency-key", "not-a-uuid"]));
  assert.throws(() => parseWalletTransferArguments([...transferDryArgs, "--execute", "--idempotency-key", "123e4567-e89b-12d3-a456-426614174000"]), /UUIDv4/);
  assert.throws(() => parseWalletTransferArguments([...transferDryArgs, "--idempotency-key", testUuidV4]), /--execute is required/);
});

test("mocked transfer execution performs exactly one gateway call with the SDK request shape", async () => {
  let calls = 0;
  let request: CreateTransferTransactionInput | undefined;
  const mutationGateway: WalletTransferGateway = {
    async submit(input) { calls += 1; request = input; return { transactionId, state: "INITIATED" }; },
  };
  const output = await runWalletTransferCommand({
    args: [...transferDryArgs, "--execute", "--idempotency-key", testUuidV4],
    sourceAddress: wallet.address,
    configuredWalletId: wallet.id,
    createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
  });
  assert.equal(calls, 1);
  assert.deepEqual(request, {
    walletId: wallet.id,
    amount: ["1.250000"],
    destinationAddress: destination,
    tokenAddress: "0x3600000000000000000000000000000000000000",
    blockchain: "ARC-TESTNET",
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    idempotencyKey: testUuidV4,
  });
  assert.equal((request as unknown as Record<string, unknown>).tokenId, undefined);
  assert.notEqual((request as unknown as Record<string, unknown>).blockchain, undefined);
  assert.match(output.join("\n"), /mutation outcome: submitted/);
  assert.match(output.join("\n"), /not transaction finality/);
});

test("token-ID transfer uses tokenId without tokenAddress or blockchain", async () => {
  let request: CreateTransferTransactionInput | undefined;
  const mutationGateway: WalletTransferGateway = {
    async submit(input) { request = input; return { transactionId, state: "INITIATED" }; },
  };
  await runWalletTransferCommand({
    args: ["--destination", destination, "--amount", "1.250000", "--token-id", "circle-token:123", "--execute", "--idempotency-key", testUuidV4],
    sourceAddress: wallet.address,
    configuredWalletId: wallet.id,
    createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
  });
  assert.deepEqual(request, {
    walletId: wallet.id,
    amount: ["1.250000"],
    destinationAddress: destination,
    tokenId: "circle-token:123",
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    idempotencyKey: testUuidV4,
  });
  assert.equal((request as unknown as Record<string, unknown>).tokenAddress, undefined);
  assert.equal((request as unknown as Record<string, unknown>).blockchain, undefined);
});

test("token-address builder cannot produce Circle's missing-token-blockchain rejection shape", async () => {
  let request: CreateTransferTransactionInput | undefined;
  const mutationGateway: WalletTransferGateway = {
    async submit(input) { request = input; return { transactionId, state: "INITIATED" }; },
  };
  await runWalletTransferCommand({
    args: [...transferDryArgs, "--execute", "--idempotency-key", testUuidV4],
    sourceAddress: wallet.address,
    configuredWalletId: wallet.id,
    createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
  });
  const shape = request as unknown as Record<string, unknown>;
  assert.equal(shape.tokenId, undefined);
  assert.equal(shape.tokenAddress, "0x3600000000000000000000000000000000000000");
  assert.equal(shape.blockchain, "ARC-TESTNET");
  assert.notEqual(shape.blockchain, undefined);
  assert.notEqual(shape.blockchain, "");
});

test("transfer never retries and timeout remains ambiguous with same-key recovery guidance", async () => {
  let calls = 0;
  const mutationGateway: WalletTransferGateway = { async submit() { calls += 1; throw new Error("timeout"); } };
  await assert.rejects(
    () => runWalletTransferCommand({
      args: [...transferDryArgs, "--execute", "--idempotency-key", testUuidV4],
      sourceAddress: wallet.address,
      configuredWalletId: wallet.id,
      createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
    }),
    (error: unknown) => error instanceof CircleMutationAmbiguousError && /SAME idempotency key/.test(error.message),
  );
  assert.equal(calls, 1);
});

test("Circle 5xx remains ambiguous and performs no automatic retry", async () => {
  let calls = 0;
  const mutationGateway: WalletTransferGateway = {
    async submit() {
      calls += 1;
      throw new CircleIntegrationError({ operation: "createTransaction", status: 503, code: "service_unavailable" });
    },
  };
  await assert.rejects(
    () => runWalletTransferCommand({
      args: [...transferDryArgs, "--execute", "--idempotency-key", testUuidV4],
      sourceAddress: wallet.address,
      configuredWalletId: wallet.id,
      createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
    }),
    (error: unknown) => error instanceof CircleMutationAmbiguousError && /SAME idempotency key/.test(error.message) && /retry blindly/.test(error.message),
  );
  assert.equal(calls, 1);
});

test("local validation is rejected without constructing dependencies or calling Circle", async () => {
  let constructed = 0;
  await assert.rejects(
    () => runWalletTransferCommand({
      args: ["--destination", "bad", "--amount", "1", "--token-id", "token-id", "--execute", "--idempotency-key", testUuidV4],
      sourceAddress: wallet.address,
      configuredWalletId: wallet.id,
      createExecutionDependencies() { constructed += 1; throw new Error("must not construct"); },
    }),
    (error: unknown) => error instanceof CircleMutationRejectedError && error.source === "local" && /No Circle mutation API call/.test(error.message),
  );
  assert.equal(constructed, 0);
});

test("explicit Circle 4xx rejection is rejected without retry or replacement-key guidance", async () => {
  let calls = 0;
  const mutationGateway: WalletTransferGateway = {
    async submit() {
      calls += 1;
      throw new CircleIntegrationError({ operation: "createTransaction", status: 400, code: "bad_request" });
    },
  };
  await assert.rejects(
    () => runWalletTransferCommand({
      args: [...transferDryArgs, "--execute", "--idempotency-key", testUuidV4],
      sourceAddress: wallet.address,
      configuredWalletId: wallet.id,
      createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
    }),
    (error: unknown) => error instanceof CircleMutationRejectedError && error.source === "circle" && /explicitly rejected/.test(error.message) && !/retry automatically/i.test(error.message),
  );
  assert.equal(calls, 1);
});

test("idempotency conflict requires recovery using the same key", async () => {
  const mutationGateway: WalletTransferGateway = {
    async submit() {
      throw new CircleIntegrationError({ operation: "createTransaction", status: 409, code: "idempotency_conflict" });
    },
  };
  await assert.rejects(
    () => runWalletTransferCommand({
      args: [...transferDryArgs, "--execute", "--idempotency-key", testUuidV4],
      sourceAddress: wallet.address,
      configuredWalletId: wallet.id,
      createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
    }),
    (error: unknown) => error instanceof CircleMutationRecoveryRequiredError && /SAME idempotency key/.test(error.message) && /existing transaction/.test(error.message),
  );
});

test("transfer publication-safe output omits wallet ID, idempotency key, and credential terms", async () => {
  const output = (await runWalletTransferCommand({ args: transferDryArgs, sourceAddress: wallet.address, configuredWalletId: wallet.id })).join("\n");
  assert.doesNotMatch(output, new RegExp(wallet.id));
  assert.doesNotMatch(output, /idempotency|api key|entity secret|ciphertext|authorization/i);
});

test("contract execution defaults to dry-run and constructs no execution dependency", async () => {
  let constructed = 0;
  const output = await runWalletContractExecutionCommand({
    args: contractDryArgs,
    sourceAddress: wallet.address,
    configuredWalletId: wallet.id,
    createExecutionDependencies() { constructed += 1; throw new Error("must not construct"); },
  });
  assert.equal(constructed, 0);
  assert.match(output.join("\n"), /dry run; no Circle mutation/);
  assert.match(output.join("\n"), /execution required: no/);
});

for (const [name, value] of [
  ["zero contract", "0x0000000000000000000000000000000000000000"],
  ["malformed contract", "bad-contract"],
] as const) {
  test(`contract execution rejects ${name}`, () => {
    assert.throws(() => parseAndPrepareContract(["--contract", value, "--function", "pause()", "--parameters", "[]"]), /contract.*non-zero|contract.*valid/i);
  });
}

test("contract execution uses native SDK ABI signature and JSON parameter mode", () => {
  const plan = parseAndPrepareContract(contractDryArgs);
  assert.equal(plan.functionSignature, "transfer(address,uint256)");
  assert.deepEqual(plan.parameters, [destination, "1000000"]);
  assert.equal(plan.parameterCount, 2);
});

for (const args of [
  ["--contract", contract, "--function", "transfer address,uint256", "--parameters", "[]"],
  ["--contract", contract, "--function", "transfer(address,uint256)", "--parameters", "not-json"],
  ["--contract", contract, "--function", "transfer(address,uint256)", "--parameters", "{}"],
  ["--contract", contract, "--function", "transfer(address,uint256)", "--parameters", "[]"],
] as const) {
  test(`contract execution rejects malformed function input: ${args[3]}`, () => assert.throws(() => parseAndPrepareContract(args)));
}

test("contract execution gate requires UUIDv4", () => {
  assert.throws(() => parseWalletContractExecutionArguments([...contractDryArgs, "--execute"]), /idempotency-key/);
  assert.throws(() => parseWalletContractExecutionArguments([...contractDryArgs, "--execute", "--idempotency-key", "bad"]));
});

test("mocked contract execution calls the gateway once and does not dump raw parameters", async () => {
  let calls = 0;
  let request: CreateContractExecutionTransactionInput | undefined;
  const mutationGateway: WalletContractExecutionGateway = {
    async submit(input) { calls += 1; request = input; return { transactionId, state: "INITIATED" }; },
  };
  await runWalletContractExecutionCommand({
    args: [...contractDryArgs, "--execute", "--idempotency-key", testUuidV4],
    sourceAddress: wallet.address,
    configuredWalletId: wallet.id,
    createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
  });
  assert.equal(calls, 1);
  assert.deepEqual(request, {
    walletId: wallet.id,
    contractAddress: contract,
    abiFunctionSignature: "transfer(address,uint256)",
    abiParameters: [destination, "1000000"],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    idempotencyKey: testUuidV4,
  });
  const dryOutput = (await runWalletContractExecutionCommand({ args: contractDryArgs, sourceAddress: wallet.address, configuredWalletId: wallet.id })).join("\n");
  assert.doesNotMatch(dryOutput, /1000000|\[|\]/);
});

test("normalized explicit Circle rejections remain attached to rejected execution errors", async () => {
  const normalized = new CircleIntegrationError({ operation: "createContractExecutionTransaction", status: 400, code: "bad_request" });
  const mutationGateway: WalletContractExecutionGateway = { async submit() { throw normalized; } };
  await assert.rejects(
    () => runWalletContractExecutionCommand({
      args: [...contractDryArgs, "--execute", "--idempotency-key", testUuidV4],
      sourceAddress: wallet.address,
      configuredWalletId: wallet.id,
      createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
    }),
    (error: unknown) => error instanceof CircleMutationRejectedError && error.cause === normalized && /status=400, code=bad_request/.test(error.message),
  );
});

test("arbitrary gateway errors are not copied into ambiguous public diagnostics", async () => {
  const mutationGateway: WalletTransferGateway = { async submit() { throw new Error("Authorization: Bearer raw-secret"); } };
  await assert.rejects(
    () => runWalletTransferCommand({
      args: [...transferDryArgs, "--execute", "--idempotency-key", testUuidV4],
      sourceAddress: wallet.address,
      configuredWalletId: wallet.id,
      createExecutionDependencies: () => ({ preflightGateway: preflightGateway(), mutationGateway }),
    }),
    (error: unknown) => error instanceof CircleMutationAmbiguousError && !/raw-secret|Bearer/.test(error.message),
  );
});

test("unknown and duplicate CLI flags are rejected", () => {
  assert.throws(() => parseWalletTransferArguments([...transferDryArgs, "--unknown"]), /Unsupported/);
  assert.throws(() => parseWalletTransferArguments([...transferDryArgs, "--amount", "2"]), /only be provided once/);
  assert.throws(() => parseWalletContractExecutionArguments([...contractDryArgs, "--function", "pause()"]), /only be provided once/);
  assert.throws(() => parseWalletContractExecutionArguments([...contractDryArgs, "--fee-level"]), /requires a value/);
});

test("execution gate never generates an idempotency key", () => {
  assert.deepEqual(parseMutationExecutionGate({ execute: false }), { execute: false });
  assert.equal(Object.hasOwn(parseWalletTransferArguments(transferDryArgs), "idempotencyKey"), false);
});

test("submission result requires a structurally valid transaction identifier", () => {
  assert.throws(() => validateSubmissionResult({ id: "not-a-uuid", state: "INITIATED" }));
  assert.deepEqual(validateSubmissionResult({ id: transactionId, state: "INITIATED" }), { transactionId, state: "INITIATED" });
});

function parseAndPrepareTransfer(args: readonly string[]) {
  return prepareWalletTransfer({ args: parseWalletTransferArguments(args), sourceAddress: wallet.address });
}

function parseAndPrepareContract(args: readonly string[]) {
  return prepareWalletContractExecution({ args: parseWalletContractExecutionArguments(args), sourceAddress: wallet.address });
}