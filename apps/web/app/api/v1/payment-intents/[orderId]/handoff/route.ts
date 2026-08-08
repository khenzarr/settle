import { NextResponse } from "next/server";

import { loadPaymentHandoff } from "../../../../../../lib/payment-handoff-service.server";
import { MarketplaceOrderServiceError } from "../../../../../../lib/payment-intent-service.server";
import { PublicAppOriginError } from "../../../../../../lib/public-app-origin.server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    return NextResponse.json(await loadPaymentHandoff((await context.params).orderId));
  } catch (cause) {
    if (cause instanceof PublicAppOriginError) {
      return NextResponse.json({ error: { code: cause.code, message: cause.message } }, { status: 503 });
    }
    const error = cause instanceof MarketplaceOrderServiceError ? cause : new MarketplaceOrderServiceError("rpc-unavailable", "Canonical order state is temporarily unavailable.");
    const status = error.code === "invalid-order-id" ? 400 : error.code === "unknown-order" ? 404 : 502;
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
  }
}