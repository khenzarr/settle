import assert from "node:assert/strict";
import test from "node:test";
import { CircleIntegrationError, normalizeCircleError } from "./errors.ts";

test("safe error normalization preserves only publication-safe Circle diagnostics", () => {
  const error = normalizeCircleError({
    message: "Bearer secret-token",
    response: {
      status: 429,
      headers: { "x-request-id": "req-123", authorization: "Bearer response-secret" },
      data: { code: "rate_limit", message: "Too many requests" },
    },
  }, "listWallets");
  assert.ok(error instanceof CircleIntegrationError);
  assert.equal(error.message, "Circle operation listWallets failed (status=429, code=rate_limit, message=Too many requests, requestId=req-123)");
  assert.equal(error.circleMessage, "Too many requests");
  assert.equal(JSON.stringify(error).includes("secret"), false);
});

test("safe error normalization supports nested SDK errors and missing fields", () => {
  const nested = normalizeCircleError({
    response: { data: { error: { code: "invalid_request", message: "Wallet ID is invalid" }, requestId: "req-456" } },
  }, "estimateContractDeploymentFee");
  assert.equal(nested.status, undefined);
  assert.equal(nested.code, "invalid_request");
  assert.equal(nested.circleMessage, "Wallet ID is invalid");
  assert.equal(nested.requestId, "req-456");

  const missing = normalizeCircleError(null, "estimateContractDeploymentFee");
  assert.equal(missing.message, "Circle operation estimateContractDeploymentFee failed");
});

test("Circle messages are credential-redacted before publication", () => {
  const error = normalizeCircleError({
    response: { data: { message: "Request failed with CIRCLE_API_KEY=api-secret" } },
  }, "estimateContractDeploymentFee");
  assert.equal(error.circleMessage, "Request failed with CIRCLE_API_KEY=[REDACTED]");
  assert.doesNotMatch(error.message, /api-secret/);
});

test("unsafe Circle diagnostics are omitted rather than exposing request material", () => {
  const error = normalizeCircleError({
    requestId: "unsafe request id",
    response: {
      status: 400,
      headers: { authorization: "Bearer header-secret" },
      data: {
        code: "invalid request code",
        message: "Invalid request body: bytecode=0x6001 constructorParameters=[secret] CIRCLE_API_KEY=api-secret",
        requestBody: { abiJson: "secret-abi", bytecode: "0x6001" },
      },
    },
  }, "estimateContractDeploymentFee");
  assert.equal(error.message, "Circle operation estimateContractDeploymentFee failed (status=400)");
  assert.equal(error.code, undefined);
  assert.equal(error.circleMessage, undefined);
  assert.equal(error.requestId, undefined);
  const serialized = JSON.stringify(error);
  assert.doesNotMatch(serialized, /header-secret|api-secret|secret-abi|0x6001|constructorParameters|requestBody/);
});

test("safe validation details retain messages and locations but never invalid values", () => {
  const error = normalizeCircleError({
    response: {
      status: 400,
      data: {
        code: "invalid_request",
        message: "Request validation failed",
        errors: [
          { location: ["body", "constructorSignature"], message: "Cannot be present with abiJson", invalidValue: "constructor(address,address,address,address,address)" },
          { field: "abiJson", message: "Mutually exclusive field", invalidValue: "very-long-secret-abi" },
          { field: "bytecode", message: "bytecode=0x6001" },
        ],
        requestId: "req-validation-1",
      },
    },
  }, "estimateContractDeploymentFee");
  assert.deepEqual(error.validationDetails, [
    { field: "body.constructorSignature", message: "Cannot be present with abiJson" },
    { field: "abiJson", message: "Mutually exclusive field" },
  ]);
  assert.match(error.message, /body\.constructorSignature: Cannot be present with abiJson/);
  assert.match(error.message, /requestId=req-validation-1/);
  assert.doesNotMatch(JSON.stringify(error), /constructor\(address|very-long-secret-abi|0x6001/);
});