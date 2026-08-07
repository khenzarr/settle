import assert from "node:assert/strict";
import test from "node:test";
import { parseDeploymentStatusArguments, parseWaitOptions, verifyArcDeploymentBytecode, waitForDeployment } from "./deployment-status.ts";

test("status arguments accept explicit IDs and safe wait controls", () => {
  assert.deepEqual(parseDeploymentStatusArguments(["--contract-id", "contract", "--transaction-id", "transaction", "--wait", "--interval-seconds", "2", "--timeout-seconds", "10"]), {
    contractId: "contract", transactionId: "transaction", wait: true, intervalSeconds: 2, timeoutSeconds: 10,
  });
  assert.throws(() => parseDeploymentStatusArguments(["--unknown"]), /Unsupported argument/);
});

test("wait returns COMPLETE and prints only changed states", async () => {
  const states = ["PENDING", "PENDING", "COMPLETE"]; let index = 0; const printed: string[] = [];
  const result = await waitForDeployment({ retrieve: async () => ({ state: states[index++]! }), intervalSeconds: 2, timeoutSeconds: 10, onChange: (s) => printed.push(s.state), sleep: async () => {}, now: () => index * 1000 });
  assert.equal(result.state, "COMPLETE"); assert.deepEqual(printed, ["PENDING", "COMPLETE"]);
});

test("wait preserves request IDs without treating request-ID churn as a status change", async () => {
  const statuses = [
    { state: "PENDING", requestId: "request-1", contract: { status: "PENDING", requestId: "contract-request-1" } },
    { state: "PENDING", requestId: "request-2", contract: { status: "PENDING", requestId: "contract-request-2" } },
    { state: "COMPLETE", requestId: "request-3", contract: { status: "COMPLETE", requestId: "contract-request-3" } },
  ];
  let index = 0;
  const printed: string[] = [];
  const result = await waitForDeployment({
    retrieve: async () => statuses[index++]!,
    intervalSeconds: 2,
    timeoutSeconds: 10,
    onChange: (status) => printed.push(status.requestId),
    sleep: async () => {},
    now: () => index * 1000,
  });
  assert.equal(result.requestId, "request-3");
  assert.deepEqual(printed, ["request-1", "request-3"]);
});

for (const state of ["CANCELLED", "DENIED", "FAILED", "STUCK"]) test(`wait stops on terminal failure ${state}`, async () => {
  await assert.rejects(() => waitForDeployment({ retrieve: async () => ({ state }), intervalSeconds: 2, timeoutSeconds: 10, onChange() {}, sleep: async () => {} }), new RegExp(state));
});

test("wait timeout and polling bounds are enforced", async () => {
  let now = 0;
  await assert.rejects(() => waitForDeployment({ retrieve: async () => ({ state: "PENDING" }), intervalSeconds: 2, timeoutSeconds: 2, onChange() {}, sleep: async () => { now = 3000; }, now: () => now }), /Timed out/);
  assert.throws(() => parseWaitOptions(["--wait", "--interval-seconds", "1"]), /at least 2/);
});

test("Arc verification requires the expected chain and non-empty code", async () => {
  const fetch = mockFetch(["0x4cef52", "0x6001"]);
  const result = await verifyArcDeploymentBytecode({ address: "0x1111111111111111111111111111111111111111", transactionHash: `0x${"a".repeat(64)}`, environment: {}, fetch });
  assert.match(result.contractUrl, /\/address\//); assert.match(result.transactionUrl!, /\/tx\//);
  await assert.rejects(() => verifyArcDeploymentBytecode({ address: result.address, environment: {}, fetch: mockFetch(["0x1"]) }), /chain ID/);
  await assert.rejects(() => verifyArcDeploymentBytecode({ address: result.address, environment: {}, fetch: mockFetch(["0x4cef52", "0x"]) }), /empty deployed bytecode/);
  await assert.rejects(() => verifyArcDeploymentBytecode({ address: result.address, transactionHash: "0x1234", environment: {}, fetch: mockFetch([]) }));
});

function mockFetch(results: unknown[]): typeof globalThis.fetch {
  let index = 0;
  return (async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: results[index++] }), { status: 200, headers: { "content-type": "application/json" } })) as typeof globalThis.fetch;
}