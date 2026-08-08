import "server-only";

import { projectOnchainPaymentIntent } from "@settle/shared";
import type { PaymentIntentView } from "@settle/shared";
import { createMarketplaceOrderDependencies, loadMarketplaceOrder, MarketplaceOrderServiceError, type MarketplaceOrderDependencies } from "./marketplace-order-service.server.ts";

export async function loadPaymentIntent(orderId: unknown, dependencies: MarketplaceOrderDependencies = createMarketplaceOrderDependencies()): Promise<PaymentIntentView> {
  const now = dependencies.now();
  const order = await loadMarketplaceOrder(orderId, { ...dependencies, now: () => now });
  return projectOnchainPaymentIntent(order, now);
}

export { MarketplaceOrderServiceError };