import { and, eq } from "drizzle-orm";
import { MerchantApiKeyService } from "../src/api-key-service.ts";
import { loadApiKeyPepperSet, validateApiKeyScopes, type ApiKeyScope } from "../src/api-keys.ts";
import { createDatabaseClient } from "../src/client.ts";
import { merchantEnvironments, merchantSettings, merchants } from "../src/schema/index.ts";
import { withTransaction } from "../src/transaction.ts";

function argument(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const name = argument("name")?.trim();
const slug = argument("slug")?.trim();
const keyName = argument("key-name", "Local integration")!.trim();
const rawScopes = argument("scopes", "payment_intents:read,payment_intents:write,webhook_endpoints:read,webhook_endpoints:write")!.split(",").map((scope) => scope.trim()).filter(Boolean);
const expiresDays = Number(argument("expires-days", "90"));

if (!name || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isInteger(expiresDays) || expiresDays < 1 || expiresDays > 365) {
  throw new Error("Usage: pnpm --filter @settle/db merchant:bootstrap:test -- --name \"Acme\" --slug acme [--key-name \"Local integration\"] [--scopes payment_intents:read,payment_intents:write,webhook_endpoints:read,webhook_endpoints:write] [--expires-days 90]");
}
validateApiKeyScopes(rawScopes);
const scopes: readonly ApiKeyScope[] = rawScopes;
const peppers = loadApiKeyPepperSet(process.env);
const client = createDatabaseClient(process.env);

try {
  const output = await withTransaction(client.db, async (tx) => {
    await tx.insert(merchants).values({ name, slug, status: "active" }).onConflictDoNothing({ target: merchants.slug });
    const merchant = await tx.query.merchants.findFirst({ where: eq(merchants.slug, slug) });
    if (!merchant || merchant.status !== "active") throw new Error("Merchant does not exist in an active state");

    await tx.insert(merchantSettings).values({ merchantId: merchant.id }).onConflictDoNothing({ target: merchantSettings.merchantId });

    await tx.insert(merchantEnvironments).values({ merchantId: merchant.id, kind: "test", status: "active", displayName: "Test mode" }).onConflictDoNothing({ target: [merchantEnvironments.merchantId, merchantEnvironments.kind] });
    const environment = await tx.query.merchantEnvironments.findFirst({ where: and(eq(merchantEnvironments.merchantId, merchant.id), eq(merchantEnvironments.kind, "test")) });
    if (!environment || environment.status !== "active") throw new Error("Merchant test environment is unavailable");

    const issued = await new MerchantApiKeyService(tx, peppers).issueTestKey({
      merchantId: merchant.id,
      environmentId: environment.id,
      name: keyName,
      scopes,
      expiresAt: new Date(Date.now() + expiresDays * 86_400_000),
      actor: { type: "system", subject: "bootstrap-test-merchant" },
    });
    return { merchantId: merchant.id, environmentId: environment.id, apiKeyId: issued.id, apiKeyPrefix: issued.prefix, apiKey: issued.plaintext, scopes: issued.scopes, expiresAt: issued.expiresAt?.toISOString() };
  });

  console.log(JSON.stringify({ warning: "Copy apiKey now. Settle stores no recoverable copy and will not show it again.", ...output }, null, 2));
} finally {
  await client.close();
}
