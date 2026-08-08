import { NextResponse } from "next/server";

import { loadOrderEvidence, createOrderEvidenceDependencies, OrderEvidenceServiceError } from "../../../../../lib/order-evidence-service.server";

export async function GET(request: Request) {
  try {
    const orderId = new URL(request.url).searchParams.get("orderId");
    if (orderId === null) return NextResponse.json({ error: { code: "INVALID_ORDER_ID", message: "Order ID is required." } }, { status: 400 });
    return NextResponse.json(await loadOrderEvidence(orderId, createOrderEvidenceDependencies()));
  } catch (cause) {
    const error = cause instanceof OrderEvidenceServiceError ? cause : new OrderEvidenceServiceError("EVIDENCE_UNAVAILABLE", "Onchain lifecycle evidence is temporarily unavailable.");
    const status = error.code === "INVALID_ORDER_ID" ? 400 : error.code === "UNKNOWN_ORDER" ? 404 : error.code === "WRONG_CHAIN" ? 502 : 503;
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
  }
}