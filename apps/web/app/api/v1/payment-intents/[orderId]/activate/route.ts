import { authorizeMerchantApiRequest, merchantApiError, merchantApiSuccess, requireEmptyActivationBody } from "../../../../../../lib/merchant-api/http.server.ts";
import { configuredCheckoutOrigin, merchantPaymentIntents } from "../../../../../../lib/merchant-api/payment-intents.server.ts";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  let requestId: string | undefined;
  try {
    const authorized = await authorizeMerchantApiRequest(request, "payment_intents:write", "payment_intents.activate");
    requestId = authorized.requestId;
    await requireEmptyActivationBody(request);
    const result = await merchantPaymentIntents().activate({ ...authorized.auth, apiKeyId: authorized.auth.apiKeyId, paymentIntentId: (await context.params).orderId, idempotencyKey: request.headers.get("idempotency-key") ?? "", requestId: authorized.auditRequestId, checkoutOrigin: configuredCheckoutOrigin() });
    return merchantApiSuccess(result.body, result.status, authorized, result.replayed);
  } catch (cause) { return merchantApiError(cause, requestId); }
}
