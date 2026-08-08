import { NextResponse } from "next/server";
import { parseArcTestnetRpcUrl, createHttpSettlementRpcTransport, createSettlementEscrowReader } from "@settle/shared";
import { planOperatorAction, OperatorActionError } from "../../../../../../lib/operator-action-service.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const operatorAddress = process.env.SETTLE_OPERATOR_ADDRESS;
    const circleWalletAddress = process.env.CIRCLE_DEPLOYER_ADDRESS;
    if (!operatorAddress || !circleWalletAddress) throw new OperatorActionError("configuration-error", "Operator dry-run is not configured.", 503);
    const reader = createSettlementEscrowReader({ transport: createHttpSettlementRpcTransport(parseArcTestnetRpcUrl(process.env)) });
    return NextResponse.json(await planOperatorAction(body, { reader, operatorAddress, circleWalletAddress }));
  } catch (cause) {
    const error = cause instanceof OperatorActionError ? cause : new OperatorActionError("operator-unavailable", "Operator dry-run is temporarily unavailable.", 503);
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
}