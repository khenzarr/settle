import { authorizeMerchantApiRequest, merchantApiError, merchantApiSuccess, readBoundedJson } from "../../../../lib/merchant-api/http.server.ts";
import { configuredCheckoutOrigin, merchantPaymentIntents } from "../../../../lib/merchant-api/payment-intents.server.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let requestId: string | undefined;
  try {
    const context = await authorizeMerchantApiRequest(request, "payment_intents:write", "payment_intents.write");
    requestId = context.requestId;
    const result = await merchantPaymentIntents().create({ ...context.auth, apiKeyId: context.auth.apiKeyId, idempotencyKey: request.headers.get("idempotency-key") ?? "", body: await readBoundedJson(request), requestId: context.auditRequestId, checkoutOrigin: configuredCheckoutOrigin() });
    return merchantApiSuccess(result.body, result.status, context, result.replayed);
  } catch (cause) { return merchantApiError(cause, requestId); }
}

export async function GET(request: Request) {
  let requestId: string | undefined;
  try {
    const context = await authorizeMerchantApiRequest(request, "payment_intents:read", "payment_intents.read");
    requestId = context.requestId;
    const query = new URL(request.url).searchParams;
    const rawLimit = query.get("limit");
    const result = await merchantPaymentIntents().list(context.auth, {
      limit: rawLimit === null ? undefined : Number(rawLimit),
      startingAfter: query.get("starting_after") ?? undefined,
      endingBefore: query.get("ending_before") ?? undefined,
      status: query.get("status") ?? undefined,
      externalOrderId: query.get("external_order_id") ?? undefined,
      createdGte: query.get("created[gte]") ?? undefined,
      createdLte: query.get("created[lte]") ?? undefined,
      checkoutOrigin: configuredCheckoutOrigin(),
    });
    return merchantApiSuccess(result, 200, context);
  } catch (cause) { return merchantApiError(cause, requestId); }
}
