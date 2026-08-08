import { NextResponse } from "next/server";

import { createMarketplaceOrderPlan } from "@settle/shared";

function hasUnknownFields(cause: unknown): boolean {
  if (typeof cause !== "object" || cause === null || !("issues" in cause) || !Array.isArray(cause.issues)) return false;
  return cause.issues.some((issue: unknown) => typeof issue === "object" && issue !== null && "code" in issue && issue.code === "unrecognized_keys");
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    return NextResponse.json({ message: "Order plan prepared", plan: createMarketplaceOrderPlan(body) });
  } catch (cause) {
    const unsupported = hasUnknownFields(cause);
    const message = cause instanceof Error ? cause.message : "The order plan request is invalid.";
    return NextResponse.json({ error: { code: unsupported ? "unsupported-input" : "invalid-request", message } }, { status: 400 });
  }
}
