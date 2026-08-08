import { NextResponse } from "next/server";

import { createMarketplaceOrderDependencies, loadMarketplaceOrder, MarketplaceOrderServiceError } from "../../../../../lib/marketplace-order-service.server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params;
    return NextResponse.json(await loadMarketplaceOrder(orderId, createMarketplaceOrderDependencies()));
  } catch (cause) {
    const error = cause instanceof MarketplaceOrderServiceError ? cause : new MarketplaceOrderServiceError("rpc-unavailable", "Canonical order state is temporarily unavailable.");
    const status = error.code === "invalid-order-id" ? 400 : error.code === "unknown-order" ? 404 : 502;
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
  }
}
