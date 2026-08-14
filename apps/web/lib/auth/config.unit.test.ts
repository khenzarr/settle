import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkOSConfig, summarizeWorkOSConfig } from "./config.ts";

const values = {
  WORKOS_CLIENT_ID: "client_placeholder",
  WORKOS_API_KEY: "api-key-placeholder",
  WORKOS_COOKIE_PASSWORD: "x".repeat(32),
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://localhost:3000/auth/callback",
};

test("WorkOS config accepts the configured localhost callback", () => assert.equal(parseWorkOSConfig(values).redirectUri, values.NEXT_PUBLIC_WORKOS_REDIRECT_URI));
test("WorkOS config requires every expected variable", () => assert.throws(() => parseWorkOSConfig({ ...values, WORKOS_API_KEY: undefined }), /WORKOS_API_KEY/));
test("WorkOS config requires a sufficiently long cookie password", () => assert.throws(() => parseWorkOSConfig({ ...values, WORKOS_COOKIE_PASSWORD: "short" }), /32/));
test("WorkOS config rejects malformed redirect URIs", () => assert.throws(() => parseWorkOSConfig({ ...values, NEXT_PUBLIC_WORKOS_REDIRECT_URI: "not-a-url" }), /valid URL/));
test("WorkOS config rejects a callback path mismatch", () => assert.throws(() => parseWorkOSConfig({ ...values, NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://localhost:3000/wrong" }), /callback/));
test("WorkOS config requires HTTPS away from localhost", () => assert.throws(() => parseWorkOSConfig({ ...values, NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://example.com/auth/callback" }), /HTTPS/));
test("safe config summary exposes classifications and no values", () => {
  const output = JSON.stringify(summarizeWorkOSConfig(values));
  assert.match(output, /present \/ localhost callback/);
  for (const secret of Object.values(values)) assert.equal(output.includes(secret), false);
});