import { createDeveloperControlledWalletsClient } from "../src/client.ts";
import { parseCircleClientConfig, parseCircleWalletReferences } from "../src/config.ts";
import { redactString } from "../src/redaction.ts";
import { createCircleWalletGateway, executeDeployerWalletPlan, planDeployerWallet } from "../src/wallets.ts";

const argumentsList = process.argv.slice(2);
const execute = argumentsList.includes("--execute");
const supportedFlags = new Set(["--execute", "--wallet-set-idempotency-key", "--wallet-idempotency-key"]);

try {
  rejectUnsupportedArguments(argumentsList, supportedFlags);
  const references = parseCircleWalletReferences(process.env);
  const plan = planDeployerWallet({
    execute,
    configuredWalletSetId: references.walletSetId,
    configuredWalletId: references.deployerWalletId,
  });

  if (!execute) {
    console.log("Circle deployer wallet plan (dry run; no API call):");
    console.log(`wallet set: ${formatPlanAction(plan.walletSet)}`);
    console.log(`wallet: ${formatPlanAction(plan.wallet)}`);
    console.log(`blockchain: ${plan.blockchain}`);
    console.log(`account type: ${plan.accountType}`);
    console.log("Run pnpm circle:wallet:create -- --execute with caller-provided idempotency keys for resources that need creation.");
  } else {
    const config = parseCircleClientConfig(process.env);
    const client = createDeveloperControlledWalletsClient(config);
    const metadata = await executeDeployerWalletPlan({
      gateway: createCircleWalletGateway(client),
      configuredWalletSetId: references.walletSetId,
      configuredWalletId: references.deployerWalletId,
      walletSetIdempotencyKey: readFlagValue(argumentsList, "--wallet-set-idempotency-key"),
      walletIdempotencyKey: readFlagValue(argumentsList, "--wallet-idempotency-key"),
    });
    console.log(`wallet set ID: ${metadata.walletSetId}`);
    console.log(`wallet ID: ${metadata.walletId}`);
    console.log(`wallet address: ${metadata.address}`);
    console.log(`blockchain: ${metadata.blockchain}`);
    console.log(`account type: ${metadata.accountType}`);
    console.log("Update CIRCLE_WALLET_SET_ID, CIRCLE_DEPLOYER_WALLET_ID, and CIRCLE_DEPLOYER_ADDRESS in your secret-managed local environment.");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redactString(message));
  process.exitCode = 1;
}

function formatPlanAction(action: Readonly<{ action: "create" } | { action: "reuse"; id: string }>): string {
  return action.action === "create" ? "create" : `reuse ${action.id}`;
}

function readFlagValue(values: readonly string[], name: string): string | undefined {
  const index = values.indexOf(name);
  if (index === -1) return undefined;
  const value = values[index + 1]?.trim();
  if (value === undefined || value === "" || value.startsWith("--")) throw new TypeError(`${name} requires a value`);
  if (!isUuid(value)) throw new TypeError(`${name} must be a UUID`);
  return value;
}

function rejectUnsupportedArguments(values: readonly string[], supportedFlags: ReadonlySet<string>): void {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--") || !supportedFlags.has(value)) throw new TypeError(`Unsupported argument: ${value}`);
    if (value !== "--execute") index += 1;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}