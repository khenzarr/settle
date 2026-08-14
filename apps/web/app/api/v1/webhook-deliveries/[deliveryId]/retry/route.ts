import { authorizeMerchantApiRequest, merchantApiError, merchantApiSuccess, requireEmptyJsonBody } from "../../../../../../lib/merchant-api/http.server.ts";
import { merchantWebhooks } from "../../../../../../lib/merchant-api/webhooks.server.ts";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ deliveryId: string }> }) {
  let requestId: string | undefined;
  try {
    const authorized = await authorizeMerchantApiRequest(request, "webhook_endpoints:write", "webhook_deliveries.retry");
    requestId = authorized.requestId;
    await requireEmptyJsonBody(request);
    const result = await merchantWebhooks().retryDelivery({ ...authorized.auth, deliveryId: (await context.params).deliveryId, apiKeyId: authorized.auth.apiKeyId, requestId: authorized.auditRequestId, idempotencyKey: request.headers.get("idempotency-key") ?? "" });
    return merchantApiSuccess(result.body, result.status, authorized, result.replayed);
  } catch (cause) { return merchantApiError(cause, requestId); }
}
