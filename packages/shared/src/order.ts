import { z } from "zod";
import { nonZeroEvmAddressSchema, orderIdSchema, termsHashSchema } from "./schemas.ts";
import { settlementSplitsSchema } from "./settlement.ts";

export const OrderStatus = { None: 0, Created: 1, Funded: 2, Disputed: 3, Completed: 4, Refunded: 5, Cancelled: 6 } as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export const DisputeResolution = { Release: 0, Refund: 1 } as const;
export type DisputeResolution = (typeof DisputeResolution)[keyof typeof DisputeResolution];

export function parseOrderStatus(value: number): OrderStatus {
  if (!Number.isInteger(value) || value < OrderStatus.None || value > OrderStatus.Cancelled) throw new Error(`Unknown order status: ${value}`);
  return value as OrderStatus;
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  const parsed = parseOrderStatus(status);
  return parsed === OrderStatus.Completed || parsed === OrderStatus.Refunded || parsed === OrderStatus.Cancelled;
}

export function hasActiveEscrowObligation(status: OrderStatus): boolean {
  const parsed = parseOrderStatus(status);
  return parsed === OrderStatus.Funded || parsed === OrderStatus.Disputed;
}

export function orderStatusLabel(status: OrderStatus): string {
  const labels = ["None", "Created", "Funded", "Disputed", "Completed", "Refunded", "Cancelled"] as const;
  return labels[parseOrderStatus(status)];
}

export const blockchainTimestampSchema = z.bigint().nonnegative();
const futureDeadlineSchema = z.bigint().positive("Deadline must be greater than zero");
export const orderLifecycleTimestampsSchema = z.object({ createdAt: blockchainTimestampSchema, fundedAt: blockchainTimestampSchema, disputedAt: blockchainTimestampSchema, settledAt: blockchainTimestampSchema, refundedAt: blockchainTimestampSchema, cancelledAt: blockchainTimestampSchema }).strict();
export const orderCreationInputSchema = z.object({ orderId: orderIdSchema, buyer: nonZeroEvmAddressSchema, totalAmount: z.bigint().positive(), fundingDeadline: futureDeadlineSchema, settlementDeadline: futureDeadlineSchema, termsHash: termsHashSchema, splits: settlementSplitsSchema }).strict().superRefine((order, context) => {
  if (order.settlementDeadline <= order.fundingDeadline) context.addIssue({ code: "custom", path: ["settlementDeadline"], message: "Settlement deadline must be later than funding deadline" });
});
export const storedOnchainOrderSchema = z.object({ buyer: nonZeroEvmAddressSchema, totalAmount: z.bigint().nonnegative(), fundingDeadline: blockchainTimestampSchema, settlementDeadline: blockchainTimestampSchema, termsHash: termsHashSchema, createdAt: blockchainTimestampSchema, fundedAt: blockchainTimestampSchema, disputedAt: blockchainTimestampSchema, settledAt: blockchainTimestampSchema, refundedAt: blockchainTimestampSchema, cancelledAt: blockchainTimestampSchema, status: z.number().int().transform(parseOrderStatus) }).strict();
export const orderSummarySchema = z.object({ orderId: orderIdSchema, buyer: nonZeroEvmAddressSchema, totalAmount: z.bigint().nonnegative(), status: z.number().int().transform(parseOrderStatus) }).strict();

export function validateOrderCreationAt(input: unknown, currentTimestamp: bigint): OrderCreationInput {
  if (currentTimestamp < 0n) throw new RangeError("Current timestamp cannot be negative");
  const order = orderCreationInputSchema.parse(input);
  if (order.fundingDeadline <= currentTimestamp) throw new Error("Funding deadline must be later than the current timestamp");
  return order;
}

export type OrderCreationInput = z.infer<typeof orderCreationInputSchema>;
export type StoredOnchainOrder = z.infer<typeof storedOnchainOrderSchema>;
export type OrderLifecycleTimestamps = z.infer<typeof orderLifecycleTimestampsSchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;