import { NextResponse } from "next/server";
import { parseArcTestnetRpcUrl } from "@settle/shared";
import { BuyerOrderError, createBuyerOrderDependencies, loadBuyerOrder } from "../../../../lib/buyer-order-intent-service.server";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body) || !Object.hasOwn(body, "orderId")) throw new BuyerOrderError("MALFORMED_ORDER_ID", "Request must contain an orderId.");
    const input = body as { orderId?: unknown; callerAddress?: unknown };
    const response = await loadBuyerOrder({ orderId: input.orderId, callerAddress: input.callerAddress }, createBuyerOrderDependencies(parseArcTestnetRpcUrl(process.env)));
    return NextResponse.json(response);
  } catch (cause) {
    const error = cause instanceof BuyerOrderError ? cause : new BuyerOrderError("RPC_FAILURE", "Unable to load order state.");
    const status = error.code === "MALFORMED_ORDER_ID" ? 400 : error.code === "UNKNOWN_ORDER" ? 404 : 502;
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
  }
}