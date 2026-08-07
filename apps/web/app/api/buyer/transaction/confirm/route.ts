import { NextResponse } from "next/server";
import { BuyerConfirmationError, confirmBuyerTransaction, createConfiguredBuyerConfirmationDependencies } from "../../../../../lib/buyer-transaction-confirmation.server";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new BuyerConfirmationError("MALFORMED_INPUT", "Request must contain orderId, transactionHash, and operation.");
    const value = body as Record<string, unknown>;
    const keys = Object.keys(value);
    if (keys.some((key) => !["orderId", "transactionHash", "operation"].includes(key)) || keys.length !== 3) throw new BuyerConfirmationError("MALFORMED_INPUT", "Only orderId, transactionHash, and operation are accepted.");
    return NextResponse.json(await confirmBuyerTransaction({ orderId: value.orderId, transactionHash: value.transactionHash, operation: value.operation }, createConfiguredBuyerConfirmationDependencies()));
  } catch (cause) {
    const error = cause instanceof BuyerConfirmationError ? cause : new BuyerConfirmationError("READ_FAILURE", "Unable to confirm the buyer transaction.");
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.code === "MALFORMED_INPUT" ? 400 : error.code === "UNKNOWN_ORDER" ? 404 : error.code === "IDENTITY_MISMATCH" ? 409 : 502 });
  }
}