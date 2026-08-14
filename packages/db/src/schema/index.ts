export * from "./audit.ts";
export * from "./api-keys.ts";
export * from "./enums.ts";
export * from "./idempotency.ts";
export * from "./merchants.ts";
export * from "./payment-intents.ts";

import { relations } from "drizzle-orm";
import { merchantApiKeys } from "./api-keys.ts";
import { merchantEnvironments, merchants } from "./merchants.ts";
import { chainOrders, paymentIntentRecipients, paymentIntents } from "./payment-intents.ts";

export const paymentIntentsRelations = relations(paymentIntents, ({ many, one }) => ({
  recipients: many(paymentIntentRecipients),
  chainOrder: one(chainOrders, { fields: [paymentIntents.id], references: [chainOrders.paymentIntentId] }),
}));
export const paymentIntentRecipientsRelations = relations(paymentIntentRecipients, ({ one }) => ({ paymentIntent: one(paymentIntents, { fields: [paymentIntentRecipients.paymentIntentId], references: [paymentIntents.id] }) }));
export const chainOrdersRelations = relations(chainOrders, ({ one }) => ({ paymentIntent: one(paymentIntents, { fields: [chainOrders.paymentIntentId], references: [paymentIntents.id] }) }));
export const merchantApiKeysRelations = relations(merchantApiKeys, ({ one }) => ({
  merchant: one(merchants, { fields: [merchantApiKeys.merchantId], references: [merchants.id] }),
  environment: one(merchantEnvironments, { fields: [merchantApiKeys.environmentId], references: [merchantEnvironments.id] }),
}));
