import { authorizeMerchantApiRequest, merchantApiError, merchantApiSuccess, readBoundedJson } from "../../../../lib/merchant-api/http.server.ts";
import { merchantWebhooks } from "../../../../lib/merchant-api/webhooks.server.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let requestId: string | undefined;
  try {
    const context = await authorizeMerchantApiRequest(request, "webhook_endpoints:write", "webhook_endpoints.write");
    requestId = context.requestId;
    const result = await merchantWebhooks().createEndpoint({ ...context.auth, apiKeyId: context.auth.apiKeyId, requestId: context.auditRequestId, idempotencyKey: request.headers.get("idempotency-key") ?? "", body: await readBoundedJson(request) });
    return merchantApiSuccess(result.body, result.status, context, result.replayed);
  } catch (cause) { return merchantApiError(cause, requestId); }
}

export async function GET(request: Request) {
  let requestId: string | undefined;
  try {
    const context = await authorizeMerchantApiRequest(request, "webhook_endpoints:read", "webhook_endpoints.read");
    requestId = context.requestId;
    return merchantApiSuccess(await merchantWebhooks().listEndpoints(context.auth), 200, context);
  } catch (cause) { return merchantApiError(cause, requestId); }
}
