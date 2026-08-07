import { createDeveloperControlledWalletsClient } from "../src/client.ts";
import { parseCircleClientConfig, parseCircleMutationWalletConfig } from "../src/config.ts";
import { createCircleWalletContractExecutionGateway, runWalletContractExecutionCommand } from "../src/wallet-contract-execution.ts";
import { redactString } from "../src/redaction.ts";
import { createCircleWalletReadOnlyGateway } from "../src/wallet-operations.ts";

try {
  const wallet = parseCircleMutationWalletConfig(process.env);
  const lines = await runWalletContractExecutionCommand({
    args: process.argv.slice(2),
    sourceAddress: wallet.deployerAddress,
    configuredWalletId: wallet.deployerWalletId,
    createExecutionDependencies: () => {
      const client = createDeveloperControlledWalletsClient(parseCircleClientConfig(process.env));
      return { preflightGateway: createCircleWalletReadOnlyGateway(client), mutationGateway: createCircleWalletContractExecutionGateway(client) };
    },
  });
  for (const line of lines) console.log(line);
} catch (error) {
  console.error(redactString(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}