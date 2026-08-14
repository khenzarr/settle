export * from "./audit.ts";
export * from "./api-keys.ts";
export * from "./enums.ts";
export * from "./idempotency.ts";
export * from "./merchants.ts";
export * from "./operator-executions.ts";
export * from "./payment-intents.ts";
export * from "./rate-limits.ts";
export * from "./webhooks.ts";

import { relations } from "drizzle-orm";
import { merchantApiKeys } from "./api-keys.ts";
import { merchantEnvironments, merchants } from "./merchants.ts";
import { operatorExecutions } from "./operator-executions.ts";
import { chainOrders, paymentIntentRecipients, paymentIntents } from "./payment-intents.ts";
import { webhookDeliveries, webhookDeliveryAttempts, webhookEndpoints, webhookEvents } from "./webhooks.ts";

export const paymentIntentsRelations = relations(paymentIntents, ({ many, one }) => ({
  recipients: many(paymentIntentRecipients),
  chainOrder: one(chainOrders, { fields: [paymentIntents.id], references: [chainOrders.paymentIntentId] }),
  operatorExecutions: many(operatorExecutions),
  webhookEvents: many(webhookEvents),
}));
export const paymentIntentRecipientsRelations = relations(paymentIntentRecipients, ({ one }) => ({ paymentIntent: one(paymentIntents, { fields: [paymentIntentRecipients.paymentIntentId], references: [paymentIntents.id] }) }));
export const chainOrdersRelations = relations(chainOrders, ({ one }) => ({ paymentIntent: one(paymentIntents, { fields: [chainOrders.paymentIntentId], references: [paymentIntents.id] }) }));
export const operatorExecutionsRelations = relations(operatorExecutions, ({ one }) => ({ paymentIntent: one(paymentIntents, { fields: [operatorExecutions.paymentIntentId], references: [paymentIntents.id] }) }));
export const merchantApiKeysRelations = relations(merchantApiKeys, ({ one }) => ({
  merchant: one(merchants, { fields: [merchantApiKeys.merchantId], references: [merchants.id] }),
  environment: one(merchantEnvironments, { fields: [merchantApiKeys.environmentId], references: [merchantEnvironments.id] }),
}));
export const webhookEndpointsRelations = relations(webhookEndpoints, ({ many, one }) => ({
  merchant: one(merchants, { fields: [webhookEndpoints.merchantId], references: [merchants.id] }),
  environment: one(merchantEnvironments, { fields: [webhookEndpoints.environmentId], references: [merchantEnvironments.id] }),
  deliveries: many(webhookDeliveries),
}));
export const webhookEventsRelations = relations(webhookEvents, ({ many, one }) => ({
  paymentIntent: one(paymentIntents, { fields: [webhookEvents.paymentIntentId], references: [paymentIntents.id] }),
  deliveries: many(webhookDeliveries),
}));
export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ many, one }) => ({
  event: one(webhookEvents, { fields: [webhookDeliveries.eventId], references: [webhookEvents.id] }),
  endpoint: one(webhookEndpoints, { fields: [webhookDeliveries.endpointId], references: [webhookEndpoints.id] }),
  attempts: many(webhookDeliveryAttempts),
}));
export const webhookDeliveryAttemptsRelations = relations(webhookDeliveryAttempts, ({ one }) => ({
  delivery: one(webhookDeliveries, { fields: [webhookDeliveryAttempts.deliveryId], references: [webhookDeliveries.id] }),
}));
