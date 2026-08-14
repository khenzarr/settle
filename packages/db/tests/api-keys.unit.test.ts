import assert from "node:assert/strict";
import test from "node:test";
import { ApiKeyConfigurationError, digestApiKey, generateApiKey, loadApiKeyPepperSet, parseApiKey, readBearerApiKey, validateApiKeyScopes, verifyApiKeyDigest } from "../src/api-keys.ts";

const pepper = "settle-test-pepper-that-is-at-least-32-bytes-long";

test("generates a parseable 256-bit test key and stores only digest material", () => {
  const generated = generateApiKey(loadApiKeyPepperSet({ SETTLE_API_KEY_PEPPER_V1: pepper }));
  const parsed = parseApiKey(generated.plaintext);
  assert.ok(parsed);
  assert.equal(Buffer.from(parsed.secret, "base64url").length, 32);
  assert.equal(parsed.keyId, generated.keyId);
  assert.equal(generated.prefix.endsWith(parsed.secret.slice(0, 8)), true);
  assert.equal(generated.secretDigest, digestApiKey(generated.plaintext, pepper));
  assert.equal(generated.secretDigest.includes(parsed.secret), false);
});

test("verifies digests and rejects altered keys", () => {
  const generated = generateApiKey(loadApiKeyPepperSet({ SETTLE_API_KEY_PEPPER_V1: pepper }));
  assert.equal(verifyApiKeyDigest(generated.plaintext, generated.secretDigest, pepper), true);
  const replacement = generated.plaintext.endsWith("A") ? "B" : "A";
  assert.equal(verifyApiKeyDigest(`${generated.plaintext.slice(0, -1)}${replacement}`, generated.secretDigest, pepper), false);
  assert.equal(verifyApiKeyDigest(generated.plaintext, "not-a-digest", pepper), false);
});

test("fails closed on weak pepper, malformed bearer values, and invalid scopes", () => {
  assert.throws(() => loadApiKeyPepperSet({}), ApiKeyConfigurationError);
  assert.throws(() => loadApiKeyPepperSet({ SETTLE_API_KEY_PEPPER_V1: "short" }), ApiKeyConfigurationError);
  assert.equal(readBearerApiKey("Bearer token"), "token");
  assert.equal(readBearerApiKey("bearer token"), undefined);
  assert.equal(readBearerApiKey("Bearer token extra"), undefined);
  assert.equal(parseApiKey("sk_test_invalid"), undefined);
  validateApiKeyScopes(["payment_intents:read"]);
  assert.throws(() => validateApiKeyScopes([]));
  assert.throws(() => validateApiKeyScopes(["payment_intents:read", "payment_intents:read"]));
  assert.throws(() => validateApiKeyScopes(["admin"]));
});
