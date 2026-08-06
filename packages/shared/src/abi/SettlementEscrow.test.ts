import assert from "node:assert/strict";
import test from "node:test";

import * as sharedApi from "../index.ts";
import { settlementEscrowAbi } from "./SettlementEscrow.ts";

type AbiEntry = (typeof settlementEscrowAbi)[number];

const functions = settlementEscrowAbi.filter(
  (entry): entry is Extract<AbiEntry, { type: "function" }> => entry.type === "function",
);
const events = settlementEscrowAbi.filter(
  (entry): entry is Extract<AbiEntry, { type: "event" }> => entry.type === "event",
);
const errors = settlementEscrowAbi.filter(
  (entry): entry is Extract<AbiEntry, { type: "error" }> => entry.type === "error",
);

test("exports the generated SettlementEscrow ABI as an array", () => {
  assert.equal(Array.isArray(settlementEscrowAbi), true);
  assert.equal(sharedApi.settlementEscrowAbi, settlementEscrowAbi);
});

test("contains contract functions, events, and custom errors", () => {
  assert.ok(functions.length > 0);
  assert.ok(events.length > 0);
  assert.ok(errors.length > 0);
});

test("contains the current SettlementEscrow lifecycle functions", () => {
  const functionNames = new Set<string>(functions.map((entry) => entry.name));
  const expectedNames = [
    "pause",
    "unpause",
    "createOrder",
    "fundOrder",
    "cancelExpiredOrder",
    "raiseDispute",
    "releaseOrder",
    "refundOrder",
    "resolveDispute",
    "getOrder",
    "getSettlementSplits",
    "orderExists",
  ];

  for (const name of expectedNames) {
    assert.equal(functionNames.has(name), true, `missing function ${name}`);
  }
});

test("does not contain duplicate function signatures", () => {
  const signatures = functions.map(
    (entry) => `${entry.name}(${entry.inputs.map((input) => input.type).join(",")})`,
  );

  assert.equal(new Set(signatures).size, signatures.length);
});

test("does not expose Foundry artifact metadata or bytecode through the shared API", () => {
  assert.equal("bytecode" in sharedApi, false);
  assert.equal("deployedBytecode" in sharedApi, false);
  assert.equal("metadata" in sharedApi, false);
  assert.deepEqual(Object.keys(sharedApi).filter((key) => /bytecode|metadata/i.test(key)), []);

  for (const entry of settlementEscrowAbi) {
    assert.equal("bytecode" in entry, false);
    assert.equal("deployedBytecode" in entry, false);
    assert.equal("metadata" in entry, false);
  }
});