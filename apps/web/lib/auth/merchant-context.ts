export const WORKOS_IDENTITY_PROVIDER = "workos";

export type MerchantRole = "owner" | "admin" | "developer" | "viewer";
export type MembershipStatus = "active" | "disabled";
export type MerchantStatus = "pending" | "active" | "suspended" | "closed";

export interface MerchantContext {
  readonly merchantId: string;
  readonly merchantName: string;
  readonly environmentId: string;
  readonly membershipId: string;
  readonly role: MerchantRole;
  readonly membershipStatus: "active";
  readonly merchantStatus: "active";
}

export type AccessibleMerchant = MerchantContext;

export interface MerchantIdentityStore {
  listActiveMemberships(provider: string, subject: string): Promise<readonly AccessibleMerchant[]>;
  findActiveMembership(provider: string, subject: string, merchantId: string): Promise<AccessibleMerchant | null>;
}

export class MerchantAccessDeniedError extends Error {
  constructor() {
    super("Merchant workspace was not found");
    this.name = "MerchantAccessDeniedError";
  }
}

export async function listAccessibleMerchants(store: MerchantIdentityStore, workosUserId: string) {
  return store.listActiveMemberships(WORKOS_IDENTITY_PROVIDER, workosUserId);
}

export async function requireMerchantMembership(store: MerchantIdentityStore, workosUserId: string, merchantId: string) {
  const context = await store.findActiveMembership(WORKOS_IDENTITY_PROVIDER, workosUserId, merchantId);
  if (!context) throw new MerchantAccessDeniedError();
  return context;
}