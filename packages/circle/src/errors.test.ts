import assert from "node:assert/strict";
import test from "node:test";
import { CircleIntegrationError, normalizeCircleError } from "./errors.ts";

function createWrappedBadRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 400,
    code: 2,
    message: "API parameter invalid",
    error: {
      code: "ERR_BAD_REQUEST",
      status: 400,
      response: {
        status: 400,
        data: {
          code: 2,
          message: "API parameter invalid",
          errors: [
            {
              error: "invalid_value",
              location: "fieldName",
              message: "safe validation message",
              invalidValue: "sensitive-request-material",
            },
          ],
        },
        headers: {
          get(name: string) {
            return name === "x-request-id" ? "safe-request-id" : undefined;
          },
        },
      },
    },
    ...overrides,
  };
}

test("installed Circle BadRequestError wrapper shape is normalized from allowlisted paths", () => {
  const raw = createWrappedBadRequest();
  const error = normalizeCircleError(raw, "deployContract");

  assert.equal(error.status, 400);
  assert.equal(error.code, "2");
  assert.equal(error.circleMessage, "API parameter invalid");
  assert.deepEqual(error.validationDetails, [{ field: "fieldName", message: "safe validation message" }]);
  assert.equal(error.requestId, "safe-request-id");
  assert.equal(error.message, "Circle operation deployContract failed (status=400, code=2, message=API parameter invalid, validation=fieldName: safe validation message, requestId=safe-request-id)");
  assert.doesNotMatch(error.message, /ERR_BAD_REQUEST|Request failed with status code|sensitive-request-material|invalidValue/);
  assert.doesNotMatch(JSON.stringify(error), /ERR_BAD_REQUEST|sensitive-request-material|invalidValue/);
});

test("Circle wrapper status preference and retained Axios response fallback are preserved", () => {
  const preferred = normalizeCircleError(createWrappedBadRequest({ status: 422 }), "deployContract");
  assert.equal(preferred.status, 422);

  const fallbackFixture = createWrappedBadRequest({ status: undefined });
  const retainedAxios = fallbackFixture.error as Record<string, unknown>;
  retainedAxios.status = undefined;
  const fallback = normalizeCircleError(fallbackFixture, "deployContract");
  assert.equal(fallback.status, 400);
});

test("numeric and string Circle codes are supported without preferring Axios transport codes", () => {
  assert.equal(normalizeCircleError(createWrappedBadRequest(), "deployContract").code, "2");
  assert.equal(normalizeCircleError(createWrappedBadRequest({ code: "invalid_request" }), "deployContract").code, "invalid_request");
});

test("Circle wrapper message is preferred and wrapped parsed-body message is its fallback", () => {
  const fixture = createWrappedBadRequest({ message: "Circle API message" });
  const retainedAxios = fixture.error as Record<string, unknown>;
  retainedAxios.message = "Request failed with status code 400";
  assert.equal(normalizeCircleError(fixture, "deployContract").circleMessage, "Circle API message");

  const fallback = normalizeCircleError(createWrappedBadRequest({ message: undefined }), "deployContract");
  assert.equal(fallback.circleMessage, "API parameter invalid");
  assert.doesNotMatch(fallback.message, /Request failed with status code 400/);
});

test("wrapped validation details sanitize messages and never retain invalidValue", () => {
  const abiLikeInvalidValue = `contract-input-${"abcdef0123456789".repeat(80)}`;
  const fixture = createWrappedBadRequest();
  const retainedAxios = fixture.error as Record<string, unknown>;
  const response = retainedAxios.response as Record<string, unknown>;
  const data = response.data as Record<string, unknown>;
  data.errors = [
    {
      location: "fieldName",
      message: "Invalid value with CIRCLE_API_KEY=api-secret",
      invalidValue: abiLikeInvalidValue,
    },
  ];

  const error = normalizeCircleError(fixture, "deployContract");
  assert.deepEqual(error.validationDetails, [
    { field: "fieldName", message: "Invalid value with CIRCLE_API_KEY=[REDACTED]" },
  ]);
  assert.match(error.message, /validation=fieldName: Invalid value with CIRCLE_API_KEY=\[REDACTED\]/);
  assert.doesNotMatch(error.message, /api-secret|contract-input|abcdef0123456789|invalidValue/);
  assert.doesNotMatch(JSON.stringify(error), /api-secret|contract-input|abcdef0123456789|invalidValue/);
});

test("request ID lookup supports AxiosHeaders get and lowercase direct properties", () => {
  assert.equal(normalizeCircleError(createWrappedBadRequest(), "deployContract").requestId, "safe-request-id");

  const fixture = createWrappedBadRequest();
  const retainedAxios = fixture.error as Record<string, unknown>;
  const response = retainedAxios.response as Record<string, unknown>;
  response.headers = { "x-request-id": "direct-request-id", authorization: "Bearer header-secret" };
  const direct = normalizeCircleError(fixture, "deployContract");
  assert.equal(direct.requestId, "direct-request-id");
  assert.doesNotMatch(JSON.stringify(direct), /header-secret|authorization/);
});

test("malformed or throwing AxiosHeaders getters do not break normalization", () => {
  for (const get of ["not-callable", () => { throw new Error("header-secret"); }]) {
    const fixture = createWrappedBadRequest();
    const retainedAxios = fixture.error as Record<string, unknown>;
    const response = retainedAxios.response as Record<string, unknown>;
    response.headers = { get, "x-request-id": "fallback-request-id", authorization: "Bearer header-secret" };
    const error = normalizeCircleError(fixture, "deployContract");
    assert.equal(error.requestId, "fallback-request-id");
    assert.doesNotMatch(error.message, /header-secret|authorization/);
  }
});

test("safe error normalization preserves only publication-safe Circle diagnostics", () => {
  const error = normalizeCircleError({
    code: "ERR_BAD_REQUEST",
    message: "Bearer secret-token",
    response: {
      status: 429,
      headers: { "x-request-id": "req-123", authorization: "Bearer response-secret" },
      data: { code: "rate_limit", message: "Too many requests" },
    },
  }, "listWallets");
  assert.ok(error instanceof CircleIntegrationError);
  assert.equal(error.message, "Circle operation listWallets failed (status=429, code=rate_limit, message=Too many requests, requestId=req-123)");
  assert.equal(error.code, "rate_limit");
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