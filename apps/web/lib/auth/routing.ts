import type { AccessibleMerchant } from "./merchant-context.ts";

export type MerchantEntry =
  | { readonly kind: "onboarding" }
  | { readonly kind: "workspace"; readonly merchantId: string }
  | { readonly kind: "selector" };

export function resolveMerchantEntry(memberships: readonly AccessibleMerchant[]): MerchantEntry {
  if (memberships.length === 0) return { kind: "onboarding" };
  if (memberships.length === 1) return { kind: "workspace", merchantId: memberships[0]!.merchantId };
  return { kind: "selector" };
}