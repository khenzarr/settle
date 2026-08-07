import { createDeveloperControlledWalletsClient } from "../src/client.ts";
import { parseCircleClientConfig, parseCircleDeploymentConfig } from "../src/config.ts";
import { redactString } from "../src/redaction.ts";
import { createCircleWalletReadOnlyGateway, formatWalletBalances, getConfiguredWalletBalances, parseSingleValueOption } from "../src/wallet-operations.ts";

try {
  const tokenAddress = parseSingleValueOption(process.argv.slice(2), "--token-address");
  const wallet = parseCircleDeploymentConfig(process.env);
  const gateway = createCircleWalletReadOnlyGateway(createDeveloperControlledWalletsClient(parseCircleClientConfig(process.env)));
  const balances = await getConfiguredWalletBalances({ gateway, configuredWalletId: wallet.deployerWalletId, configuredAddress: wallet.deployerAddress, ...(tokenAddress === undefined ? {} : { tokenAddress }) });
  for (const line of formatWalletBalances(balances)) console.log(line);
} catch (error) {
  console.error(redactString(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}