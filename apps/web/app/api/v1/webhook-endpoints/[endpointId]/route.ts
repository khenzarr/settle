import { authorizeMerchantApiRequest, merchantApiError, merchantApiSuccess, readBoundedJson } from "../../../../../lib/merchant-api/http.server.ts";
import { merchantWebhooks } from "../../../../../lib/merchant-api/webhooks.server.ts";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ endpointId: string }> }) {
  let requestId: string | undefined;
  try {
    const authorized = await authorizeMerchantApiRequest(request, "webhook_endpoints:write", "webhook_endpoints.write");
    requestId = authorized.requestId;
    const result = await merchantWebhooks().updateEndpoint({ ...authorized.auth, endpointId: (await context.params).endpointId, apiKeyId: authorized.auth.apiKeyId, requestId: authorized.auditRequestId, idempotencyKey: request.headers.get("idempotency-key") ?? "", body: await readBoundedJson(request) });
    return merchantApiSuccess(result.body, result.status, authorized, result.replayed);
  } catch (cause) { return merchantApiError(cause, requestId); }
}
