import "server-only";

import { and, asc, eq } from "drizzle-orm";
import type { SettleDatabase } from "@settle/db/client";
import { createDatabaseClient } from "@settle/db/client";
import { merchantEnvironments, merchantMembers, merchants } from "@settle/db/schema";
import type { AccessibleMerchant, MerchantIdentityStore } from "./merchant-context.ts";

let databaseClient: ReturnType<typeof createDatabaseClient> | undefined;

export function getWebDatabase(): SettleDatabase {
  databaseClient ??= createDatabaseClient();
  return databaseClient.db;
}

function rowToContext(row: {
  merchantId: string;
  merchantName: string;
  environmentId: string;
  membershipId: string;
  role: "owner" | "admin" | "developer" | "viewer";
}): AccessibleMerchant {
  return { ...row, membershipStatus: "active", merchantStatus: "active" };
}

export function createMerchantIdentityStore(db: SettleDatabase = getWebDatabase()): MerchantIdentityStore {
  const selection = {
    merchantId: merchants.id,
    merchantName: merchants.name,
    environmentId: merchantEnvironments.id,
    membershipId: merchantMembers.id,
    role: merchantMembers.role,
  };
  const activeTenant = and(
    eq(merchantMembers.status, "active"),
    eq(merchants.status, "active"),
    eq(merchantEnvironments.kind, "test"),
    eq(merchantEnvironments.status, "active"),
  );
  return {
    async listActiveMemberships(provider, subject) {
      const rows = await db.select(selection).from(merchantMembers)
        .innerJoin(merchants, eq(merchantMembers.merchantId, merchants.id))
        .innerJoin(merchantEnvironments, eq(merchantEnvironments.merchantId, merchants.id))
        .where(and(eq(merchantMembers.provider, provider), eq(merchantMembers.subject, subject), activeTenant))
        .orderBy(asc(merchants.name), asc(merchants.id));
      return rows.map(rowToContext);
    },
    async findActiveMembership(provider, subject, merchantId) {
      const rows = await db.select(selection).from(merchantMembers)
        .innerJoin(merchants, eq(merchantMembers.merchantId, merchants.id))
        .innerJoin(merchantEnvironments, eq(merchantEnvironments.merchantId, merchants.id))
        .where(and(eq(merchantMembers.provider, provider), eq(merchantMembers.subject, subject), eq(merchants.id, merchantId), activeTenant))
        .limit(1);
      return rows[0] ? rowToContext(rows[0]) : null;
    },
  };
}