import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalWebhookJson,
  classifyWebhookResponse,
  createWebhookSignatureHeader,
  decryptWebhookSigningSecret,
  encryptWebhookSigningSecret,
  isForbiddenWebhookAddress,
  loadWebhookEncryptionKeySet,
  validateWebhookEndpointUrl,
  validateWebhookSubscriptions,
  verifyWebhookSignatureHeader,
  webhookPayloadHash,
  webhookRetryDelaySeconds,
} from "../src/webhook-security.ts";

const keys = loadWebhookEncryptionKeySet({ SETTLE_WEBHOOK_ENCRYPTION_KEY_V1: Buffer.alloc(32, 7).toString("base64") });

test("webhook signing secrets are authenticated-encrypted and non-recoverable from ciphertext", () => {
  const secret = `whsec_${"a".repeat(43)}`;
  const ciphertext = encryptWebhookSigningSecret(secret, keys);
  assert.equal(ciphertext.includes(secret), false);
  assert.equal(decryptWebhookSigningSecret(ciphertext, keys), secret);
  assert.throws(() => decryptWebhookSigningSecret(`${ciphertext.slice(0, -1)}x`, keys), /could not be decrypted|malformed/);
});

test("webhook key configuration requires an exact base64-encoded 32-byte key", () => {
  assert.throws(() => loadWebhookEncryptionKeySet({}), /required/);
  assert.throws(() => loadWebhookEncryptionKeySet({ SETTLE_WEBHOOK_ENCRYPTION_KEY_V1: Buffer.alloc(31).toString("base64") }), /32 bytes/);
  assert.throws(() => loadWebhookEncryptionKeySet({ SETTLE_WEBHOOK_ENCRYPTION_KEY_V1: "not-base64" }), /32 bytes|base64/);
});

test("canonical raw bodies and HMAC fixtures are stable and timestamp bounded", () => {
  const rawBody = canonicalWebhookJson({ z: 2, a: { y: true, x: [3, "four"] } });
  assert.equal(rawBody, '{"a":{"x":[3,"four"],"y":true},"z":2}');
  assert.equal(webhookPayloadHash(rawBody), "06101a4be17505a98e29dc17ddc6f3bebb0d64a029a0919c01b1beca03575049");
  const signature = createWebhookSignatureHeader("fixture-secret", 1_800_000_000, rawBody);
  assert.equal(verifyWebhookSignatureHeader("fixture-secret", signature, rawBody, 1_800_000_100, 300), true);
  assert.equal(verifyWebhookSignatureHeader("wrong-secret", signature, rawBody, 1_800_000_100, 300), false);
  assert.equal(verifyWebhookSignatureHeader("fixture-secret", signature, rawBody, 1_800_000_301, 300), false);
  assert.equal(verifyWebhookSignatureHeader("fixture-secret", signature, `${rawBody} `, 1_800_000_100, 300), false);
});

test("webhook URL validation rejects credentials, redirects-to-local primitives, and private literals", () => {
  assert.equal(validateWebhookEndpointUrl("https://hooks.example.com/settle?tenant=one"), "https://hooks.example.com/settle?tenant=one");
  for (const value of [
    "http://hooks.example.com/settle",
    "https://user:pass@hooks.example.com/settle",
    "https://hooks.example.com:8443/settle",
    "https://hooks.example.com/settle#fragment",
    "https://localhost/settle",
    "https://127.0.0.1/settle",
    "https://[::1]/settle",
    "https://10.1.2.3/settle",
  ]) assert.throws(() => validateWebhookEndpointUrl(value));
});

test("SSRF address policy rejects non-public IPv4 and IPv6 ranges", () => {
  for (const value of ["0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "198.18.0.1", "203.0.113.1", "224.0.0.1", "::", "::1", "fc00::1", "fe80::1", "2001:db8::1"]) assert.equal(isForbiddenWebhookAddress(value), true, value);
  assert.equal(isForbiddenWebhookAddress("8.8.8.8"), false);
  assert.equal(isForbiddenWebhookAddress("2606:4700:4700::1111"), false);
});

test("subscriptions, retry classes, and deterministic backoff are bounded", () => {
  assert.deepEqual(validateWebhookSubscriptions(["payment_intent.funded", "payment_intent.created"]), ["payment_intent.created", "payment_intent.funded"]);
  assert.throws(() => validateWebhookSubscriptions([]));
  assert.throws(() => validateWebhookSubscriptions(["payment_intent.created", "payment_intent.created"]));
  assert.throws(() => validateWebhookSubscriptions(["arbitrary.event"]));
  assert.equal(classifyWebhookResponse(204), "delivered");
  assert.equal(classifyWebhookResponse(429), "retryable_failure");
  assert.equal(classifyWebhookResponse(503), "retryable_failure");
  assert.equal(classifyWebhookResponse(400), "terminal_failure");
  assert.equal(classifyWebhookResponse(undefined, "timeout"), "retryable_failure");
  assert.equal(classifyWebhookResponse(undefined, "destination_rejected"), "terminal_failure");
  assert.equal(webhookRetryDelaySeconds(3, "delivery-a"), webhookRetryDelaySeconds(3, "delivery-a"));
  assert.ok(webhookRetryDelaySeconds(1, "delivery-a") >= 24 && webhookRetryDelaySeconds(1, "delivery-a") <= 36);
  assert.ok(webhookRetryDelaySeconds(20, "delivery-a") <= 21_600 * 1.2);
});
