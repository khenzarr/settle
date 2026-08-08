import { ARC_TESTNET } from "./chains.ts";
import { orderIdSchema, type EvmAddress, type OrderId } from "./schemas.ts";
import type { MarketplaceNetwork, MarketplaceOrderPlan, MarketplaceOrderView } from "./marketplace.ts";

export type PaymentIntentSource = "plan" | "onchain";
export type PaymentState = "planned" | "awaiting-payment" | "payment-window-expired" | "funded" | "disputed" | "completed" | "refunded" | "cancelled";
export type CanonicalOrderStatus = "None" | "Created" | "Funded" | "Disputed" | "Completed" | "Refunded" | "Cancelled";

export type PaymentIntentView = {
  readonly orderId: OrderId;
  readonly source: PaymentIntentSource;
  readonly canonicalStatus: CanonicalOrderStatus;
  readonly paymentState: PaymentState;
  readonly buyer: EvmAddress;
  readonly amount: { readonly baseUnits: string; readonly usdc: string; readonly currency: "USDC" };
  readonly deadlines: { readonly funding: string; readonly settlement: string };
  readonly network: MarketplaceNetwork;
  readonly checkout: { readonly pageAvailable: boolean; readonly paymentActionAvailable: boolean; readonly path?: string; readonly reason?: string };
  readonly customerActions: readonly ("pay" | "raise-dispute")[];
  readonly lifecycle: { readonly escrow: "not-funded" | "held" | "released" | "returned"; readonly settlement: "not-settled" | "completed" };
  readonly settlementSummary: readonly { readonly recipient: string; readonly shareBps: number; readonly expectedAmountBaseUnits: string; readonly expectedAmountUsdc: string }[];
  readonly evidence: MarketplaceOrderView["evidence"];
  readonly externalOrderId?: string;
};

export const checkoutPath = (orderId: string): `/pay/${OrderId}` => `/pay/${orderIdSchema.parse(orderId)}`;

function canonicalStatus(status: string): CanonicalOrderStatus {
  if (["None", "Created", "Funded", "Disputed", "Completed", "Refunded", "Cancelled"].includes(status)) return status as CanonicalOrderStatus;
  throw new Error("Unsupported canonical order status");
}

function paymentStateFor(status: Exclude<CanonicalOrderStatus, "None">, expired: boolean): PaymentState {
  switch (status) {
    case "Created": return expired ? "payment-window-expired" : "awaiting-payment";
    case "Funded": return "funded";
    case "Disputed": return "disputed";
    case "Completed": return "completed";
    case "Refunded": return "refunded";
    case "Cancelled": return "cancelled";
  }
}

function network(): MarketplaceNetwork {
  return { blockchain: ARC_TESTNET.name, chainId: ARC_TESTNET.chainId, settlementContract: ARC_TESTNET.settlementEscrow.address, usdc: ARC_TESTNET.usdc.address };
}

export function projectPlannedPaymentIntent(plan: Omit<MarketplaceOrderPlan, "paymentIntent">): PaymentIntentView {
  return {
    orderId: plan.order.orderId, source: "plan", canonicalStatus: "None", paymentState: "planned", buyer: plan.order.buyer,
    amount: { ...plan.order.amount, currency: "USDC" }, deadlines: { funding: plan.order.fundingDeadline, settlement: plan.order.settlementDeadline }, network: plan.network,
    checkout: { pageAvailable: false, paymentActionAvailable: false, reason: "marketplace-create-required" }, customerActions: [],
    lifecycle: { escrow: "not-funded", settlement: "not-settled" }, settlementSummary: plan.order.settlement.map(({ recipient, shareBps, expectedAmountBaseUnits, expectedAmountUsdc }) => ({ recipient, shareBps, expectedAmountBaseUnits: expectedAmountBaseUnits!, expectedAmountUsdc: expectedAmountUsdc! })),
    evidence: { completeness: "unavailable", lifecycle: [], payouts: [], warnings: [] }, externalOrderId: plan.externalOrderId,
  };
}

export function projectOnchainPaymentIntent(view: MarketplaceOrderView, now: bigint): PaymentIntentView {
  const status = canonicalStatus(view.statusLabel);
  if (status === "None") throw new Error("An onchain Payment Intent requires an existing canonical order");
  const expired = status === "Created" && BigInt(view.deadlines.funding) <= now;
  const paymentState = paymentStateFor(status, expired);
  const canPay = paymentState === "awaiting-payment";
  const escrow = status === "Funded" || status === "Disputed" ? "held" : status === "Completed" ? "released" : status === "Refunded" ? "returned" : "not-funded";
  return {
    orderId: view.orderId, source: "onchain", canonicalStatus: status, paymentState, buyer: view.buyer,
    amount: { ...view.amount, currency: "USDC" }, deadlines: view.deadlines, network: network(),
    checkout: { pageAvailable: true, paymentActionAvailable: canPay, path: checkoutPath(view.orderId), ...(canPay ? {} : { reason: paymentState === "payment-window-expired" ? "payment-window-expired" : "payment-not-permitted" }) },
    customerActions: canPay ? ["pay"] : status === "Funded" ? ["raise-dispute"] : [], lifecycle: { escrow, settlement: status === "Completed" ? "completed" : "not-settled" },
    settlementSummary: view.settlement, evidence: view.evidence,
  };
}