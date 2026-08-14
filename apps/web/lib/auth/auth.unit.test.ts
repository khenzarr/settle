import assert from "node:assert/strict";
import test from "node:test";
import { extractAuthenticatedIdentity } from "./identity.ts";
import { listAccessibleMerchants, MerchantAccessDeniedError, requireMerchantMembership, type AccessibleMerchant, type MerchantIdentityStore } from "./merchant-context.ts";
import { validateMerchantName } from "./onboarding.ts";
import { resolveMerchantEntry } from "./routing.ts";

const merchantA: AccessibleMerchant = { merchantId: "merchant-a", merchantName: "A", environmentId: "env-a", membershipId: "member-a", role: "owner", membershipStatus: "active", merchantStatus: "active" };
const merchantB: AccessibleMerchant = { merchantId: "merchant-b", merchantName: "B", environmentId: "env-b", membershipId: "member-b", role: "viewer", membershipStatus: "active", merchantStatus: "active" };

function store(rows: readonly AccessibleMerchant[]): MerchantIdentityStore {
  return {
    async listActiveMemberships(provider, subject) {
      assert.equal(provider, "workos");
      assert.equal(subject, "user-a");
      return rows;
    },
    async findActiveMembership(provider, subject, merchantId) {
      assert.equal(provider, "workos");
      return subject === "user-a" ? rows.find((row) => row.merchantId === merchantId) ?? null : null;
    },
  };
}

test("authenticated identity uses the stable WorkOS user ID", () => {
  const user = { id: "user-a", email: "ignored@example.com" };
  assert.deepEqual(extractAuthenticatedIdentity(user), { workosUserId: "user-a" });
});

test("authenticated identity fails closed without a WorkOS user ID", () => {
  assert.throws(() => extractAuthenticatedIdentity({}), /no user ID/);
  assert.throws(() => extractAuthenticatedIdentity(null), /no user ID/);
});

test("membership lookup maps WorkOS user ID through provider and subject", async () => {
  assert.deepEqual(await listAccessibleMerchants(store([merchantA]), "user-a"), [merchantA]);
});

test("zero memberships route to onboarding", () => assert.deepEqual(resolveMerchantEntry([]), { kind: "onboarding" }));
test("one membership resolves its explicit workspace", () => assert.deepEqual(resolveMerchantEntry([merchantA]), { kind: "workspace", merchantId: "merchant-a" }));
test("multiple memberships require explicit selection", () => assert.deepEqual(resolveMerchantEntry([merchantA, merchantB]), { kind: "selector" }));

test("authorized merchant URL resolves local tenant context", async () => {
  assert.equal((await requireMerchantMembership(store([merchantA]), "user-a", "merchant-a")).membershipId, "member-a");
});

test("changing merchant URL cannot grant cross-tenant access", async () => {
  await assert.rejects(requireMerchantMembership(store([merchantA]), "user-a", "merchant-b"), MerchantAccessDeniedError);
});

test("unknown identity cannot reuse another identity membership", async () => {
  await assert.rejects(requireMerchantMembership(store([merchantA]), "user-b", "merchant-a"), MerchantAccessDeniedError);
});

test("merchant name validation trims and accepts plain display text", () => assert.equal(validateMerchantName("  North Market  "), "North Market"));
test("merchant name validation rejects empty input", () => assert.throws(() => validateMerchantName("   "), /required/));
test("merchant name validation rejects overlong input", () => assert.throws(() => validateMerchantName("a".repeat(161)), /160/));
test("merchant name validation rejects control characters", () => assert.throws(() => validateMerchantName("North\u0000Market"), /control/));
test("merchant name validation does not interpret HTML", () => assert.equal(validateMerchantName("<b>Market</b>"), "<b>Market</b>"));