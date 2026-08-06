import assert from "node:assert/strict";
import test from "node:test";
import { REDACTED, redactSecrets, redactString } from "./redaction.ts";

test("credential redaction is exact for named fields, headers, bearer tokens, and ciphertext", () => {
  assert.deepEqual(redactSecrets({
    CIRCLE_API_KEY: "api-secret",
    nested: {
      CIRCLE_ENTITY_SECRET: "entity-secret",
      DEPLOYER_PRIVATE_KEY: "private-key",
      Authorization: "Bearer token-value",
      entitySecretCiphertext: "ciphertext-value",
      safe: "wallet-id",
    },
  }), {
    CIRCLE_API_KEY: REDACTED,
    nested: {
      CIRCLE_ENTITY_SECRET: REDACTED,
      DEPLOYER_PRIVATE_KEY: REDACTED,
      Authorization: REDACTED,
      entitySecretCiphertext: REDACTED,
      safe: "wallet-id",
    },
  });
  assert.equal(
    redactString("Authorization: Bearer abc.def CIRCLE_API_KEY=key entity_secret_ciphertext=cipher DEPLOYER_PRIVATE_KEY=0x123"),
    "Authorization: [REDACTED] CIRCLE_API_KEY=[REDACTED] entity_secret_ciphertext=[REDACTED] DEPLOYER_PRIVATE_KEY=[REDACTED]",
  );
});