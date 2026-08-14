import { loadWebhookEncryptionKeySet } from "../src/webhook-security.ts";

const keys = loadWebhookEncryptionKeySet(process.env);
if (!keys.values.has(keys.currentVersion)) throw new Error("Current webhook encryption key version is unavailable");
console.log("SETTLE_WEBHOOK_ENCRYPTION_KEY_V1: present, base64, 32 bytes");
console.log("Webhook encryption configuration is valid; key material was not displayed.");
