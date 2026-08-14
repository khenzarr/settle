import { z } from "zod";

import { createMarketplaceOrderPlan, type MarketplaceOrderPlan } from "./marketplace.ts";
import { nonZeroEvmAddressSchema, normalizeAddress, type EvmAddress } from "./schemas.ts";

const externalOrderIdSchema = z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/, "external_order_id must contain printable ASCII without control characters");
const metadataValueSchema = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]);
const metadataSchema = z.record(z.string().min(1).max(80), metadataValueSchema).superRefine((value, context) => {
  if (Object.keys(value).length > 20) context.addIssue({ code: "custom", message: "metadata may contain at most 20 keys" });
  if (new TextEncoder().encode(JSON.stringify(value)).length > 4096) context.addIssue({ code: "custom", message: "metadata must not exceed 4096 bytes" });
});

export const merchantPaymentIntentCreateSchema = z.object({
  external_order_id: externalOrderIdSchema,
  buyer: nonZeroEvmAddressSchema,
  amount: z.string().min(1).max(96),
  currency: z.literal("USDC"),
  funding_deadline: z.string().datetime({ offset: true }),
  settlement_deadline: z.string().datetime({ offset: true }),
  settlement_recipients: z.array(z.object({
    address: nonZeroEvmAddressSchema,
    share_bps: z.number().int().min(1).max(10_000),
  }).strict()).min(1).max(8),
  metadata: metadataSchema.optional().default({}),
}).strict();

export type MerchantPaymentIntentCreateRequest = z.input<typeof merchantPaymentIntentCreateSchema>;
export type NormalizedMerchantPaymentIntentCreate = Readonly<{
  externalOrderId: string;
  buyer: EvmAddress;
  amount: string;
  currency: "USDC";
  fundingDeadline: Date;
  settlementDeadline: Date;
  recipients: readonly Readonly<{ address: EvmAddress; shareBps: number }>[];
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  plan: MarketplaceOrderPlan;
}>;

function canonicalMetadata(metadata: Readonly<Record<string, string | number | boolean | null>>) {
  return Object.fromEntries(Object.entries(metadata).sort(([left], [right]) => left.localeCompare(right)));
}

export function normalizeMerchantPaymentIntentCreate(input: unknown, now = new Date()): NormalizedMerchantPaymentIntentCreate {
  const parsed = merchantPaymentIntentCreateSchema.parse(input);
  const fundingDeadline = new Date(parsed.funding_deadline);
  const settlementDeadline = new Date(parsed.settlement_deadline);
  if (fundingDeadline <= now) throw new RangeError("funding_deadline must be in the future");
  if (settlementDeadline <= fundingDeadline) throw new RangeError("settlement_deadline must be later than funding_deadline");
  if (fundingDeadline.getTime() > now.getTime() + 30 * 24 * 60 * 60 * 1000) throw new RangeError("funding_deadline must be within 30 days");
  if (settlementDeadline.getTime() > fundingDeadline.getTime() + 90 * 24 * 60 * 60 * 1000) throw new RangeError("settlement_deadline must be within 90 days of funding_deadline");

  const recipients = parsed.settlement_recipients.map((recipient) => ({ address: normalizeAddress(recipient.address), shareBps: recipient.share_bps }));
  const plan = createMarketplaceOrderPlan({
    externalOrderId: parsed.external_order_id,
    buyer: parsed.buyer,
    amountUsdc: parsed.amount,
    fundingDeadline: Math.floor(fundingDeadline.getTime() / 1000).toString(),
    settlementDeadline: Math.floor(settlementDeadline.getTime() / 1000).toString(),
    settlement: recipients.map((recipient) => ({ recipient: recipient.address, shareBps: recipient.shareBps })),
  });
  return {
    externalOrderId: plan.externalOrderId,
    buyer: plan.order.buyer,
    amount: plan.order.amount.usdc,
    currency: "USDC",
    fundingDeadline,
    settlementDeadline,
    recipients,
    metadata: canonicalMetadata(parsed.metadata),
    plan,
  };
}

export function canonicalMerchantPaymentIntentRequest(input: NormalizedMerchantPaymentIntentCreate): string {
  return JSON.stringify({
    external_order_id: input.externalOrderId,
    buyer: input.buyer,
    amount_base_units: input.plan.order.amount.baseUnits,
    currency: input.currency,
    funding_deadline: Math.floor(input.fundingDeadline.getTime() / 1000),
    settlement_deadline: Math.floor(input.settlementDeadline.getTime() / 1000),
    settlement_recipients: input.recipients,
    metadata: canonicalMetadata(input.metadata),
  });
}
