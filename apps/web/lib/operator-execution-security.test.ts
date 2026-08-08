import assert from "node:assert/strict";
import { test } from "node:test";
import { OrderStatus, getExplorerTransactionUrl } from "@settle/shared";
import {
  InMemoryOperatorExecutionStore,
  OperatorExecutionSecurityError,
  acceptProvisionedServerIdempotencyKey,
  authorizeOperatorRequest,
  describeOperatorExecution,
  mayPrepareForCanonicalStatus,
  operatorExecutionIdentityKey,
  parseOperatorExecutionIdentity,
  projectPublicOperatorExecutionStatus,
  requireProductionExecutionCapabilities,
  requireTrustedOperatorOrigin,
  transitionOperatorExecution,
  type OperatorAuthorizationGateway,
  type OperatorExecutionProgress,
  type OperatorExecutionRecord,
  type OperatorExecutionStore,
} from "./operator-execution-security.server.ts";

const orderId = `0x${"ab".repeat(32)}`;
const otherOrderId = `0x${"cd".repeat(32)}`;
const idempotencyKey = acceptProvisionedServerIdempotencyKey("123e4567-e89b-42d3-a456-426614174000");
const transactionHash = `0x${"12".repeat(32)}`;

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://settle.example/api/operator/execution", { method: "POST", headers });
}

function executionRequest(origin = "https://settle.example"): Request {
  return request({ origin, host: "settle.example" });
}

function record(state: OperatorExecutionProgress = "prepared"): OperatorExecutionRecord {
  return { identity: parseOperatorExecutionIdentity({ operation: "release-order", orderId }), state, idempotencyKey };
}

function hasCode(code: string): (error: unknown) => boolean {
  return (error) => error instanceof OperatorExecutionSecurityError && error.code === code;
}

test("authorization is injected server-side and client role claims are not request input", async () => {
  const gateway: OperatorAuthorizationGateway = {
    async authorize() { return { subject: "operator-123", role: "operator" }; },
  };
  assert.deepEqual(await authorizeOperatorRequest(request(), gateway), { subject: "operator-123", role: "operator" });
  assert.throws(() => parseOperatorExecutionIdentity({ operation: "release-order", orderId, isOperator: true }), hasCode("invalid-request"));
  assert.throws(() => parseOperatorExecutionIdentity({ operation: "release-order", orderId, role: "operator" }), hasCode("invalid-request"));
});

test("missing or invalid authorization fails closed", async () => {
  await assert.rejects(authorizeOperatorRequest(request()), hasCode("unauthorized"));
  await assert.rejects(authorizeOperatorRequest(request(), { async authorize() { return { subject: "", role: "operator" }; } }), hasCode("unauthorized"));
});

test("trusted origin requires exact origin, host, and protocol", () => {
  assert.doesNotThrow(() => requireTrustedOperatorOrigin(executionRequest(), { expectedOrigin: "https://settle.example" }));
  assert.throws(() => requireTrustedOperatorOrigin(executionRequest("https://evil.example"), { expectedOrigin: "https://settle.example" }), hasCode("origin-rejected"));
  assert.throws(() => requireTrustedOperatorOrigin(request({ host: "settle.example" }), { expectedOrigin: "https://settle.example" }), hasCode("origin-rejected"));
  assert.throws(() => requireTrustedOperatorOrigin(executionRequest("not an origin"), { expectedOrigin: "https://settle.example" }), hasCode("origin-rejected"));
  assert.throws(() => requireTrustedOperatorOrigin(request({ origin: "https://settle.example", host: "other.example" }), { expectedOrigin: "https://settle.example" }), hasCode("origin-rejected"));
  assert.throws(() => requireTrustedOperatorOrigin(request({ origin: "https://settle.example", host: "settle.example", "x-forwarded-proto": "http" }), { expectedOrigin: "https://settle.example" }), hasCode("origin-rejected"));
});

test("trusted expected origin is server configuration and insecure development is explicit", () => {
  assert.throws(() => parseOperatorExecutionIdentity({ operation: "release-order", orderId, expectedOrigin: "https://evil.example" }), hasCode("invalid-request"));
  const local = new Request("http://localhost:3000/operator", { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000" } });
  assert.throws(() => requireTrustedOperatorOrigin(local, { expectedOrigin: "http://localhost:3000" }), hasCode("execution-disabled"));
  assert.doesNotThrow(() => requireTrustedOperatorOrigin(local, { expectedOrigin: "http://localhost:3000", allowInsecureDevelopmentOrigin: true }));
});

test("identity permits only create/release and normalizes operation plus order ID", () => {
  const create = parseOperatorExecutionIdentity({ operation: "create-order", orderId: orderId.toUpperCase().replace("0X", "0x") });
  const release = parseOperatorExecutionIdentity({ operation: "release-order", orderId });
  assert.equal(create.orderId, orderId);
  assert.notEqual(operatorExecutionIdentityKey(create), operatorExecutionIdentityKey(release));
  assert.equal(operatorExecutionIdentityKey(release), operatorExecutionIdentityKey(parseOperatorExecutionIdentity({ operation: "release-order", orderId })));
  assert.notEqual(operatorExecutionIdentityKey(release), operatorExecutionIdentityKey(parseOperatorExecutionIdentity({ operation: "release-order", orderId: otherOrderId })));
  for (const operation of ["approve", "fund-order", "refund-order"]) {
    assert.throws(() => parseOperatorExecutionIdentity({ operation, orderId }), hasCode("invalid-request"));
  }
});

test("browser schema rejects idempotency and execution controls", () => {
  for (const field of ["idempotencyKey", "walletId", "execute", "retry", "calldata", "target"]) {
    assert.throws(() => parseOperatorExecutionIdentity({ operation: "create-order", orderId, [field]: "x" }), hasCode("invalid-request"));
  }
});

test("state policy blocks duplicate submission and never treats submission as success", () => {
  assert.deepEqual(describeOperatorExecution("prepared"), { progress: "prepared", duplicateExecutionBlocked: false, mayStartNewExecution: false, recovery: "none", publicStatus: "ready" });
  for (const state of ["submitting", "submitted", "confirmation-pending"] as const) {
    const policy = describeOperatorExecution(state);
    assert.equal(policy.duplicateExecutionBlocked, true);
    assert.equal(policy.mayStartNewExecution, false);
    assert.equal(policy.publicStatus, "pending");
  }
  assert.equal(describeOperatorExecution("complete").duplicateExecutionBlocked, true);
  assert.equal(describeOperatorExecution("complete").mayStartNewExecution, false);
  assert.equal(describeOperatorExecution("rejected").publicStatus, "failed");
});

test("ambiguous execution recovers the existing attempt without automatic resubmit", () => {
  const policy = describeOperatorExecution("ambiguous");
  assert.equal(policy.duplicateExecutionBlocked, true);
  assert.equal(policy.mayStartNewExecution, false);
  assert.equal(policy.recovery, "check-existing");
  assert.equal(JSON.stringify(policy).includes("resubmit"), false);
  assert.equal(JSON.stringify(policy).includes("idempotency"), false);
});

test("state machine allows bounded forward/recovery transitions and rejects backward replay", () => {
  assert.equal(transitionOperatorExecution(record("prepared"), "submitting").idempotencyKey, idempotencyKey);
  assert.equal(transitionOperatorExecution(record("submitting"), "ambiguous").state, "ambiguous");
  assert.equal(transitionOperatorExecution(record("ambiguous"), "confirmation-pending").state, "confirmation-pending");
  assert.throws(() => transitionOperatorExecution(record("submitted"), "prepared"), hasCode("invalid-request"));
  assert.throws(() => transitionOperatorExecution(record("complete"), "submitting"), hasCode("invalid-request"));
});

test("in-memory store suppresses identical identities but separates distinct identities", async () => {
  const store = new InMemoryOperatorExecutionStore();
  await store.create(record());
  await assert.rejects(store.create(record()), hasCode("execution-already-exists"));
  await assert.doesNotReject(store.create({ ...record(), identity: parseOperatorExecutionIdentity({ operation: "release-order", orderId: otherOrderId }) }));
  await assert.doesNotReject(store.create({ ...record(), identity: parseOperatorExecutionIdentity({ operation: "create-order", orderId }) }));
});

test("public status exposes only validated publication-safe transaction data", () => {
  const internal = { ...record("ambiguous"), transactionHash, circleTransactionId: "circle-id", internalError: new Error("secret walletId") };
  const output = projectPublicOperatorExecutionStatus(internal);
  assert.equal(output.transactionHash, transactionHash);
  assert.equal(output.arcScanUrl, getExplorerTransactionUrl(transactionHash as never));
  const json = JSON.stringify(output);
  for (const secret of ["idempotency", "circle-id", "walletId", "internalError", "secret"]) assert.equal(json.includes(secret), false);
  assert.throws(() => projectPublicOperatorExecutionStatus({ ...record(), transactionHash: "invalid" }));
});

test("production capability requires enabled execution, real auth, and durable storage", () => {
  const auth: OperatorAuthorizationGateway = { async authorize() { return { subject: "operator", role: "operator" }; } };
  assert.throws(() => requireProductionExecutionCapabilities({ executionEnabled: false, authorizationGateway: auth, store: new InMemoryOperatorExecutionStore() }), hasCode("execution-disabled"));
  assert.throws(() => requireProductionExecutionCapabilities({ executionEnabled: true, store: new InMemoryOperatorExecutionStore() }), hasCode("unauthorized"));
  assert.throws(() => requireProductionExecutionCapabilities({ executionEnabled: true, authorizationGateway: auth, store: new InMemoryOperatorExecutionStore() }), hasCode("durable-store-required"));
  const durable = { durable: true, async get() { return undefined; }, async create() {}, async update() {} } satisfies OperatorExecutionStore;
  assert.doesNotThrow(() => requireProductionExecutionCapabilities({ executionEnabled: true, authorizationGateway: auth, store: durable }));
});

test("canonical status gates fresh preparation, including demo-002 Completed release", () => {
  assert.equal(mayPrepareForCanonicalStatus("create-order", OrderStatus.None), true);
  assert.equal(mayPrepareForCanonicalStatus("create-order", OrderStatus.Created), false);
  assert.equal(mayPrepareForCanonicalStatus("release-order", OrderStatus.Funded), true);
  assert.equal(mayPrepareForCanonicalStatus("release-order", OrderStatus.Completed), false);
});