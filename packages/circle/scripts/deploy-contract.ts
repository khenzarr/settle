import { createCircleContractsClient, createDeveloperControlledWalletsClient } from "../src/client.ts";
import { parseCircleClientConfig, parseCircleDeploymentConfig } from "../src/config.ts";
import { runDeploymentCommand, submitDeployment } from "../src/contract-deployment.ts";
import { prepareSettlementEscrowDeployment } from "../src/contracts.ts";
import { redactString } from "../src/redaction.ts";
import { createCircleWalletGateway, preflightDeployerWallet } from "../src/wallets.ts";

const args = process.argv.slice(2);
try {
  const deploymentConfig = parseCircleDeploymentConfig(process.env);
  const preparation = await prepareSettlementEscrowDeployment(deploymentConfig);
  let clientConfig: ReturnType<typeof parseCircleClientConfig> | undefined;
  const getClientConfig = () => clientConfig ??= parseCircleClientConfig(process.env);
  const output = await runDeploymentCommand({
    args,
    preparation,
    preflight: async () => preflightDeployerWallet({ gateway: createCircleWalletGateway(createDeveloperControlledWalletsClient(getClientConfig())), configuredWalletId: preparation.deployerWalletId, configuredAddress: preparation.deployerAddress }),
    submit: async (request, idempotencyKey) => submitDeployment({ client: createCircleContractsClient(getClientConfig()), request, idempotencyKey }),
  });
  for (const line of output) console.log(line);
} catch (error) {
  console.error(redactString(error instanceof Error ? error.message : String(error)));
  if (args.includes("--execute")) console.error("If Circle accepted the request but the response was ambiguous, retry only with the same idempotency key.");
  process.exitCode = 1;
}