import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { auditEvents, merchantEnvironments, merchantMembers, merchantSettings, merchants } from "@settle/db/schema";
import { withTransaction } from "@settle/db/transaction";
import { getWebDatabase } from "./merchant-store.server.ts";
import { WORKOS_IDENTITY_PROVIDER } from "./merchant-context.ts";

export interface OnboardingResult {
  readonly merchantId: string;
  readonly created: boolean;
}

function merchantSlug(name: string): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) || "merchant";
  return `${base}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export async function createFirstMerchant(workosUserId: string, merchantName: string): Promise<OnboardingResult> {
  return withTransaction(getWebDatabase(), async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workosUserId}, 0))`);

    const existing = await tx.select({ merchantId: merchantMembers.merchantId }).from(merchantMembers)
      .where(and(
        eq(merchantMembers.provider, WORKOS_IDENTITY_PROVIDER),
        eq(merchantMembers.subject, workosUserId),
        eq(merchantMembers.status, "active"),
      )).orderBy(merchantMembers.createdAt).limit(1);
    if (existing[0]) return { merchantId: existing[0].merchantId, created: false };

    const [merchant] = await tx.insert(merchants).values({ name: merchantName, slug: merchantSlug(merchantName), status: "active" }).returning({ id: merchants.id });
    if (!merchant) throw new Error("Merchant creation did not return an ID");
    const [member] = await tx.insert(merchantMembers).values({ merchantId: merchant.id, provider: WORKOS_IDENTITY_PROVIDER, subject: workosUserId, role: "owner", status: "active" }).returning({ id: merchantMembers.id });
    const [environment] = await tx.insert(merchantEnvironments).values({ merchantId: merchant.id, kind: "test", status: "active", displayName: "Test" }).returning({ id: merchantEnvironments.id });
    if (!member || !environment) throw new Error("Merchant onboarding records were not created");
    await tx.insert(merchantSettings).values({ merchantId: merchant.id });
    await tx.insert(auditEvents).values({
      merchantId: merchant.id,
      environmentId: environment.id,
      actorType: "merchant_member",
      actorSubject: member.id,
      action: "merchant.onboarded",
      resourceType: "merchant",
      resourceId: merchant.id,
      metadataJson: { environmentKind: "test", identityProvider: WORKOS_IDENTITY_PROVIDER },
    });
    return { merchantId: merchant.id, created: true };
  });
}