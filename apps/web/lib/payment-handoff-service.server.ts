import "server-only";

import { projectPaymentHandoff, type PaymentHandoff, type PaymentIntentView } from "@settle/shared";
import { loadPaymentIntent } from "./payment-intent-service.server.ts";
import { loadPublicAppOrigin, type PublicAppOriginEnvironment } from "./public-app-origin.server.ts";
import type { MarketplaceOrderDependencies } from "./marketplace-order-service.server.ts";

export function createPaymentHandoff(
  intent: PaymentIntentView,
  environment: PublicAppOriginEnvironment = process.env,
): PaymentHandoff {
  return projectPaymentHandoff(intent, loadPublicAppOrigin(environment));
}

export async function loadPaymentHandoff(
  orderId: unknown,
  dependencies?: MarketplaceOrderDependencies,
  environment: PublicAppOriginEnvironment = process.env,
): Promise<PaymentHandoff> {
  const intent = await loadPaymentIntent(orderId, dependencies);
  return createPaymentHandoff(intent, environment);
}