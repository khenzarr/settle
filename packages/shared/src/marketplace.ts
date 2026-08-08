import { keccak256, stringToHex } from "viem";
import { z } from "zod";

import { ARC_TESTNET } from "./chains.ts";
import { formatUsdcAmount, parseUsdcAmount } from "./money.ts";
import { OrderStatus, hasActiveEscrowObligation } from "./order.ts";
import { orderIdSchema, nonZeroEvmAddressSchema, normalizeAddress, termsHashSchema, type EvmAddress, type OrderId, type TermsHash } from "./schemas.ts";
import { calculateSettlementPayouts, settlementSplitsSchema, type SettlementSplit } from "./settlement.ts";
import type { OrderEvidence } from "./settlement-evidence.ts";
import type { SettlementOrderProjection } from "./settlement-read.ts";

export function canonicalSettlementFields(domain: string, fields: readonly (readonly [string, string])[]): string {
  return [domain, ...fields.map(([name, value]) => `${name.length}:${name}:${new TextEncoder().encode(value).length}:${value}`)].join("\n");
}

export function hashSettlementText(value: string): `0x${string}` {
  const hash = keccak256(stringToHex(value));
  if (/^0x0+$/.test(hash)) throw new TypeError("Deterministic identifier unexpectedly resolved to zero bytes32");
  return hash;
}

const externalOrderIdSchema = z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/, "externalOrderId must contain printable ASCII without control characters");
const timestampSchema = z.string().regex(/^(0|[1-9]\d*)$/, "Deadline must be a Unix timestamp in seconds").transform((value) => BigInt(value));

export const marketplaceOrderPlanRequestSchema = z.object({
  externalOrderId: externalOrderIdSchema,
  buyer: nonZeroEvmAddressSchema,
  amountUsdc: z.string(),
  fundingDeadline: timestampSchema,
  settlementDeadline: timestampSchema,
  settlement: settlementSplitsSchema,
}).strict();

export type MarketplaceOrderPlanRequest = z.input<typeof marketplaceOrderPlanRequestSchema>;
export type MarketplaceOrderPlan = {
  readonly mode: "plan";
  readonly executionAvailable: false;
  readonly externalOrderId: string;
  readonly order: MarketplaceOrderPlanOrder;
  readonly network: MarketplaceNetwork;
  readonly next: { readonly action: "marketplace-create-required"; readonly checkoutAvailable: false };
};
export type MarketplaceOrderPlanOrder = {
  readonly orderId: OrderId; readonly buyer: EvmAddress;
  readonly amount: { readonly baseUnits: string; readonly usdc: string };
  readonly fundingDeadline: string; readonly settlementDeadline: string; readonly termsHash: TermsHash;
  readonly settlement: readonly MarketplaceSettlementSplit[];
};
export type MarketplaceSettlementSplit = SettlementSplit & { readonly expectedAmountBaseUnits?: string; readonly expectedAmountUsdc?: string };
export type MarketplaceNetwork = { readonly blockchain: string; readonly chainId: number; readonly settlementContract: string; readonly usdc: string };

export type MarketplaceExecutionCapability = { readonly protocolAvailable: boolean; readonly executionAvailable: boolean; readonly reason?: string };
export type MarketplaceOrderAction = { readonly action: string; readonly actor: "customer" | "public" | "marketplace-operator" | "arbitrator"; readonly protocolAvailable: boolean; readonly executionAvailable: boolean; readonly capability: MarketplaceExecutionCapability };
export type MarketplaceOrderView = {
  readonly orderId: OrderId; readonly status: string; readonly statusLabel: string; readonly buyer: EvmAddress;
  readonly amount: { readonly baseUnits: string; readonly usdc: string };
  readonly deadlines: { readonly funding: string; readonly settlement: string };
  readonly escrow: { readonly active: boolean };
  readonly settlement: readonly Required<MarketplaceSettlementSplit>[];
  readonly actions: { readonly customer: readonly MarketplaceOrderAction[]; readonly public: readonly MarketplaceOrderAction[]; readonly marketplace: readonly MarketplaceOrderAction[]; readonly arbitration: readonly MarketplaceOrderAction[] };
  readonly evidence: { readonly completeness: "complete" | "partial" | "unavailable"; readonly lifecycle: readonly unknown[]; readonly payouts: readonly unknown[]; readonly warnings: readonly string[] };
};

function action(actionName: string, actor: MarketplaceOrderAction["actor"], protocolAvailable: boolean, executionAvailable: boolean, reason?: string): MarketplaceOrderAction {
  const capability = { protocolAvailable, executionAvailable, ...(reason ? { reason } : {}) };
  return { action: actionName, actor, protocolAvailable, executionAvailable, capability };
}

function planFields(input: { externalOrderId: string; buyer: string; amountBaseUnits: bigint; fundingDeadline: bigint; settlementDeadline: bigint; settlement: readonly SettlementSplit[] }): readonly (readonly [string, string])[] {
  return [["externalOrderId", input.externalOrderId], ["buyer", normalizeAddress(input.buyer)], ["amountBaseUnits", input.amountBaseUnits.toString()], ["fundingDeadline", input.fundingDeadline.toString()], ["settlementDeadline", input.settlementDeadline.toString()], ["settlement", input.settlement.map((split) => `${normalizeAddress(split.recipient)}:${split.shareBps}`).join(",")]];
}

export function normalizeMarketplaceOrderPlanRequest(input: unknown): { externalOrderId: string; buyer: EvmAddress; amountBaseUnits: bigint; amountUsdc: string; fundingDeadline: bigint; settlementDeadline: bigint; settlement: SettlementSplit[] } {
  const parsed = marketplaceOrderPlanRequestSchema.parse(input);
  const externalOrderId = parsed.externalOrderId.trim();
  if (externalOrderId.length === 0) throw new Error("externalOrderId must not be blank");
  const amountBaseUnits = parseUsdcAmount(parsed.amountUsdc);
  if (parsed.settlementDeadline <= parsed.fundingDeadline) throw new Error("Settlement deadline must be later than funding deadline");
  const settlement = parsed.settlement.map((split) => ({ ...split, recipient: normalizeAddress(split.recipient) }));
  return { externalOrderId, buyer: normalizeAddress(parsed.buyer), amountBaseUnits, amountUsdc: formatUsdcAmount(amountBaseUnits), fundingDeadline: parsed.fundingDeadline, settlementDeadline: parsed.settlementDeadline, settlement };
}

export function createMarketplaceOrderPlan(input: unknown): MarketplaceOrderPlan {
  const normalized = normalizeMarketplaceOrderPlanRequest(input);
  const fields = planFields(normalized);
  const orderId = orderIdSchema.parse(hashSettlementText(canonicalSettlementFields("settle.marketplace.order-id.v1", fields)));
  const termsHash = termsHashSchema.parse(hashSettlementText(canonicalSettlementFields("settle.marketplace.terms.v1", fields)));
  const payouts = calculateSettlementPayouts(normalized.amountBaseUnits, normalized.settlement);
  return { mode: "plan", executionAvailable: false, externalOrderId: normalized.externalOrderId, order: { orderId, buyer: normalized.buyer, amount: { baseUnits: normalized.amountBaseUnits.toString(), usdc: normalized.amountUsdc }, fundingDeadline: normalized.fundingDeadline.toString(), settlementDeadline: normalized.settlementDeadline.toString(), termsHash, settlement: normalized.settlement.map((split, index) => ({ ...split, expectedAmountBaseUnits: payouts[index]!.toString(), expectedAmountUsdc: formatUsdcAmount(payouts[index]!) })) }, network: { blockchain: ARC_TESTNET.name, chainId: ARC_TESTNET.chainId, settlementContract: ARC_TESTNET.settlementEscrow.address, usdc: ARC_TESTNET.usdc.address }, next: { action: "marketplace-create-required", checkoutAvailable: false } };
}

export function projectMarketplaceOrder(input: { order: SettlementOrderProjection; now: bigint; evidence?: OrderEvidence; evidenceWarning?: string }): MarketplaceOrderView {
  const { order, now, evidence, evidenceWarning } = input;
  const customer: MarketplaceOrderAction[] = [];
  const publicActions: MarketplaceOrderAction[] = [];
  const marketplace: MarketplaceOrderAction[] = [];
  const arbitration: MarketplaceOrderAction[] = [];
  if (order.status === OrderStatus.Created && now < order.fundingDeadline) { customer.push(action("approve", "customer", true, true), action("fund", "customer", true, true)); }
  if (order.status === OrderStatus.Created && now >= order.fundingDeadline) publicActions.push(action("cancel-expired", "public", true, true));
  if (order.status === OrderStatus.Funded) { customer.push(action("raise-dispute", "customer", true, true)); marketplace.push(action("release", "marketplace-operator", true, false, "Operator execution is disabled in the current deployment."), action("refund", "marketplace-operator", true, false, "Operator execution is disabled in the current deployment.")); }
  if (order.status === OrderStatus.Disputed) arbitration.push(action("resolve-dispute", "arbitrator", true, false, "Arbitrator execution is disabled in the current deployment."));
  const warning = evidenceWarning ? [evidenceWarning] : [];
  return { orderId: order.orderId, status: order.statusLabel.toLowerCase(), statusLabel: order.statusLabel, buyer: order.buyer, amount: { baseUnits: order.totalAmountBaseUnits.toString(), usdc: order.totalAmountUsdc }, deadlines: { funding: order.fundingDeadline.toString(), settlement: order.settlementDeadline.toString() }, escrow: { active: hasActiveEscrowObligation(order.status) }, settlement: order.expectedPayouts.map((split) => ({ recipient: split.recipient, shareBps: split.shareBps, expectedAmountBaseUnits: split.expectedPayoutBaseUnits.toString(), expectedAmountUsdc: split.expectedPayoutUsdc })), actions: { customer, public: publicActions, marketplace, arbitration }, evidence: { completeness: evidence ? evidence.completeness : evidenceWarning ? "partial" : "unavailable", lifecycle: evidence?.timeline ?? [], payouts: evidence?.settlementPayouts ?? [], warnings: [...(evidence?.warnings ?? []), ...warning] } };
}
