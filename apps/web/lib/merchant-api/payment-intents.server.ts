import "server-only";

import { MerchantPaymentIntentService } from "@settle/db/payment-intent-service";

import { getWebDatabase } from "../auth/merchant-store.server.ts";
import { loadPaymentIntent } from "../payment-intent-service.server.ts";
import { loadPublicAppOrigin } from "../public-app-origin.server.ts";

export const merchantPaymentIntents = () => new MerchantPaymentIntentService(getWebDatabase());

export function configuredCheckoutOrigin() {
  try { return loadPublicAppOrigin(); }
  catch { return undefined; }
}

export async function loadMerchantPaymentIntentDetail(tenant: Readonly<{ merchantId: string; environmentId: string }>, id: string) {
  const resource = await merchantPaymentIntents().get(tenant, id, configuredCheckoutOrigin());
  if (!resource.canonical) return resource;
  try {
    const fresh = await loadPaymentIntent(resource.order_id);
    return { ...resource, canonical: { ...resource.canonical, status: fresh.canonicalStatus, payment_state: fresh.paymentState, read_source: "fresh_rpc" as const } };
  } catch {
    return { ...resource, canonical: { ...resource.canonical, read_source: "stored_projection" as const, reconciliation_issue: true } };
  }
}
