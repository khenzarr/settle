import { hostname } from "node:os";
import { randomUUID } from "node:crypto";

import { createDatabaseClient } from "../src/client.ts";
import { WebhookDeliveryWorker } from "../src/webhook-delivery-worker.ts";
import { loadWebhookEncryptionKeySet } from "../src/webhook-security.ts";

const rawLimit = process.argv.find((argument) => argument.startsWith("--limit="))?.slice("--limit=".length) ?? "10";
const limit = Number(rawLimit);
if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("--limit must be an integer from 1 to 50");

const client = createDatabaseClient(process.env);
try {
  const workerId = `${hostname().slice(0, 40)}:${process.pid}:${randomUUID().slice(0, 8)}`;
  const results = await new WebhookDeliveryWorker(client.db, loadWebhookEncryptionKeySet(process.env)).processBatch(workerId, limit);
  const summary = results.reduce<Record<string, number>>((counts, delivery) => {
    counts[delivery.status] = (counts[delivery.status] ?? 0) + 1;
    return counts;
  }, {});
  console.log(JSON.stringify({ claimed: results.length, statuses: summary }));
} finally {
  await client.close();
}
