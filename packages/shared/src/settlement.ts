import { z } from "zod";
import { BASIS_POINTS_TOTAL, MAX_SETTLEMENT_RECIPIENTS } from "./constants.ts";
import { nonZeroEvmAddressSchema, normalizeAddress } from "./schemas.ts";

export const settlementSplitSchema = z.object({
  recipient: nonZeroEvmAddressSchema,
  shareBps: z.number().int("Share must be an integer").positive("Share must be greater than zero").max(BASIS_POINTS_TOTAL),
}).strict();

export type SettlementSplit = z.infer<typeof settlementSplitSchema>;

export const settlementSplitsSchema = z.array(settlementSplitSchema)
  .min(1, "At least one settlement recipient is required")
  .max(MAX_SETTLEMENT_RECIPIENTS, `At most ${MAX_SETTLEMENT_RECIPIENTS} settlement recipients are allowed`)
  .superRefine((splits, context) => {
    const seen = new Set<string>();
    let total = 0;
    splits.forEach((split, index) => {
      const normalized = normalizeAddress(split.recipient);
      if (seen.has(normalized)) context.addIssue({ code: "custom", path: [index, "recipient"], message: "Duplicate settlement recipient" });
      seen.add(normalized);
      total += split.shareBps;
    });
    if (total !== BASIS_POINTS_TOTAL) context.addIssue({ code: "custom", message: `Settlement shares must total ${BASIS_POINTS_TOTAL}; received ${total}` });
  });

export function validateSettlementSplits(splits: unknown): SettlementSplit[] {
  return settlementSplitsSchema.parse(splits).map((split) => ({ ...split, recipient: normalizeAddress(split.recipient) }));
}

export function calculateSettlementPayouts(totalAmount: bigint, splits: unknown): bigint[] {
  if (totalAmount < 0n) throw new RangeError("Settlement amount cannot be negative");
  const validSplits = validateSettlementSplits(splits);
  let distributed = 0n;
  return validSplits.map((split, index) => {
    if (index === validSplits.length - 1) return totalAmount - distributed;
    const payout = totalAmount * BigInt(split.shareBps) / BigInt(BASIS_POINTS_TOTAL);
    distributed += payout;
    return payout;
  });
}