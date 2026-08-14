import { NextResponse } from "next/server";

import { loadPaymentIntent, MarketplaceOrderServiceError } from "../../../../../lib/payment-intent-service.server";
import { authorizeMerchantApiRequest, merchantApiError, merchantApiSuccess } from "../../../../../lib/merchant-api/http.server.ts";
import { loadMerchantPaymentIntentDetail } from "../../../../../lib/merchant-api/payment-intents.server.ts";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const identifier = (await context.params).orderId;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)) {
    let requestId: string | undefined;
    try {
      const authorized = await authorizeMerchantApiRequest(request, "payment_intents:read", "payment_intents.read");
      requestId = authorized.requestId;
      return merchantApiSuccess(await loadMerchantPaymentIntentDetail(authorized.auth, identifier), 200, authorized);
    } catch (cause) { return merchantApiError(cause, requestId); }
  }
  try {
    return NextResponse.json(await loadPaymentIntent(identifier));
  } catch (cause) {
    const error = cause instanceof MarketplaceOrderServiceError ? cause : new MarketplaceOrderServiceError("rpc-unavailable", "Canonical order state is temporarily unavailable.");
    const status = error.code === "invalid-order-id" ? 400 : error.code === "unknown-order" ? 404 : 502;
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
  }
}
