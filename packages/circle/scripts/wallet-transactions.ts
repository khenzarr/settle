import { createDeveloperControlledWalletsClient } from "../src/client.ts";
import { parseCircleClientConfig, parseCircleDeploymentConfig } from "../src/config.ts";
import { redactString } from "../src/redaction.ts";
import { createCircleWalletReadOnlyGateway, formatWalletTransactions, getConfiguredWalletTransactions, parseSingleValueOption } from "../src/wallet-operations.ts";

try {
  const rawPageSize = parseSingleValueOption(process.argv.slice(2), "--page-size");
  const pageSize = rawPageSize === undefined ? undefined : Number(rawPageSize);
  const wallet = parseCircleDeploymentConfig(process.env);
  const gateway = createCircleWalletReadOnlyGateway(createDeveloperControlledWalletsClient(parseCircleClientConfig(process.env)));
  const transactions = await getConfiguredWalletTransactions({ gateway, configuredWalletId: wallet.deployerWalletId, configuredAddress: wallet.deployerAddress, ...(pageSize === undefined ? {} : { pageSize }) });
  for (const line of formatWalletTransactions(transactions)) console.log(line);
} catch (error) {
  console.error(redactString(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}