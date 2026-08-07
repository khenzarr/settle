import { createCircleContractsClient, createDeveloperControlledWalletsClient } from "../src/client.ts";
import { parseCircleClientConfig, parseCircleDeploymentConfig } from "../src/config.ts";
import { estimateDeployment, formatSafeFeeEstimate } from "../src/contract-deployment.ts";
import { prepareSettlementEscrowDeployment } from "../src/contracts.ts";
import { redactString } from "../src/redaction.ts";
import { createCircleWalletGateway, preflightDeployerWallet } from "../src/wallets.ts";

try {
  if (process.argv.length > 2) throw new TypeError(`Unsupported argument(s): ${process.argv.slice(2).join(", ")}`);
  const deploymentConfig = parseCircleDeploymentConfig(process.env);
  const preparation = await prepareSettlementEscrowDeployment(deploymentConfig);
  const clientConfig = parseCircleClientConfig(process.env);
  await preflightDeployerWallet({ gateway: createCircleWalletGateway(createDeveloperControlledWalletsClient(clientConfig)), configuredWalletId: preparation.deployerWalletId, configuredAddress: preparation.deployerAddress });
  const estimate = await estimateDeployment({ client: createCircleContractsClient(clientConfig), preparation });
  for (const line of formatSafeFeeEstimate(estimate)) console.log(line);
} catch (error) {
  console.error(redactString(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}