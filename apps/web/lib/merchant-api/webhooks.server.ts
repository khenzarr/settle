import "server-only";

import { loadWebhookEncryptionKeySet } from "@settle/db/webhook-security";
import { MerchantWebhookService } from "@settle/db/webhook-service";

import { getWebDatabase } from "../auth/merchant-store.server.ts";

export const merchantWebhooks = () => new MerchantWebhookService(getWebDatabase(), loadWebhookEncryptionKeySet(process.env));
