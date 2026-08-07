import assert from "node:assert/strict";
import test from "node:test";
import { CircleConfigError, findPublicCircleCredentialNames, getCircleConfigPresence, parseCircleClientConfig, parseCircleDeploymentConfig, parseCircleDeploymentReferences, parseCircleWalletReferences, parseUuidV4 } from "./config.ts";

test("environment validation accepts complete server credentials", () => {
  assert.deepEqual(parseCircleClientConfig({ CIRCLE_API_KEY: " api-key ", CIRCLE_ENTITY_SECRET: " entity-secret " }), {
    apiKey: "api-key",
    entitySecret: "entity-secret",
  });
});

test("missing credentials report exact missing field names", () => {
  assert.throws(
    () => parseCircleClientConfig({}),
    (error: unknown) => error instanceof CircleConfigError
      && assert.deepEqual(error.missingFields, ["CIRCLE_API_KEY", "CIRCLE_ENTITY_SECRET"]) === undefined,
  );
});

test("empty environment values are treated as missing", () => {
  assert.deepEqual(getCircleConfigPresence({ CIRCLE_API_KEY: "", CIRCLE_ENTITY_SECRET: "   " }), {
    CIRCLE_API_KEY: false,
    CIRCLE_ENTITY_SECRET: false,
    CIRCLE_WALLET_SET_ID: false,
    CIRCLE_DEPLOYER_WALLET_ID: false,
    CIRCLE_DEPLOYER_ADDRESS: false,
  });
  assert.deepEqual(parseCircleWalletReferences({ CIRCLE_WALLET_SET_ID: " ", CIRCLE_DEPLOYER_WALLET_ID: "" }), {});
});

test("public Circle credential prefixes are detected without reading values", () => {
  assert.deepEqual(findPublicCircleCredentialNames({
    NEXT_PUBLIC_CIRCLE_API_KEY: "secret",
    NEXT_PUBLIC_CIRCLE_ENTITY_SECRET: "secret",
    NEXT_PUBLIC_CIRCLE_WALLET_ID: "safe-name",
  }), ["NEXT_PUBLIC_CIRCLE_API_KEY", "NEXT_PUBLIC_CIRCLE_ENTITY_SECRET"]);
});

test("deployment configuration validates and normalizes all constructor addresses", () => {
  const config = parseCircleDeploymentConfig({
    CIRCLE_DEPLOYER_WALLET_ID: "wallet-id",
    CIRCLE_DEPLOYER_ADDRESS: "0x1111111111111111111111111111111111111111",
    SETTLE_ADMIN_ADDRESS: "0x2222222222222222222222222222222222222222",
    SETTLE_OPERATOR_ADDRESS: "0x3333333333333333333333333333333333333333",
    SETTLE_ARBITRATOR_ADDRESS: "0x4444444444444444444444444444444444444444",
    SETTLE_PAUSER_ADDRESS: "0x5555555555555555555555555555555555555555",
  });
  assert.equal(config.deployerWalletId, "wallet-id");
  assert.equal(config.pauserAddress, "0x5555555555555555555555555555555555555555");
});

test("optional deployment references treat empty values as absent", () => {
  assert.deepEqual(parseCircleDeploymentReferences({ CIRCLE_SETTLEMENT_CONTRACT_ID: " ", CIRCLE_DEPLOYMENT_TRANSACTION_ID: "" }), {});
});

test("optional deployment references validate UUIDs and the settlement address", () => {
  assert.deepEqual(parseCircleDeploymentReferences({
    CIRCLE_SETTLEMENT_CONTRACT_ID: "11111111-1111-4111-8111-111111111111",
    CIRCLE_DEPLOYMENT_TRANSACTION_ID: "22222222-2222-4222-8222-222222222222",
    SETTLEMENT_CONTRACT_ADDRESS: "0x1111111111111111111111111111111111111111",
  }).contractId, "11111111-1111-4111-8111-111111111111");
  assert.throws(() => parseCircleDeploymentReferences({ CIRCLE_SETTLEMENT_CONTRACT_ID: "bad" }));
  assert.throws(() => parseCircleDeploymentReferences({ SETTLEMENT_CONTRACT_ADDRESS: `0x${"0".repeat(40)}` }));
});

test("execution idempotency keys must be UUIDv4", () => {
  assert.equal(parseUuidV4("11111111-1111-4111-8111-111111111111", "key"), "11111111-1111-4111-8111-111111111111");
  assert.throws(() => parseUuidV4("bad", "key"));
  assert.throws(() => parseUuidV4("11111111-1111-5111-8111-111111111111", "key"), /UUIDv4/);
});