import { authorizeMerchantApiRequest, merchantApiError, merchantApiSuccess } from "../../../../../../lib/merchant-api/http.server.ts";
import { merchantWebhooks } from "../../../../../../lib/merchant-api/webhooks.server.ts";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ endpointId: string }> }) {
  let requestId: string | undefined;
  try {
    const authorized = await authorizeMerchantApiRequest(request, "webhook_endpoints:read", "webhook_endpoints.read");
    requestId = authorized.requestId;
    const rawLimit = new URL(request.url).searchParams.get("limit");
    const body = await merchantWebhooks().listDeliveries(authorized.auth, (await context.params).endpointId, rawLimit === null ? 25 : Number(rawLimit));
    return merchantApiSuccess(body, 200, authorized);
  } catch (cause) { return merchantApiError(cause, requestId); }
}
