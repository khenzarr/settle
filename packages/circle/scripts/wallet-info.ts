import { createDeveloperControlledWalletsClient } from "../src/client.ts";
import { parseCircleClientConfig, parseCircleDeploymentConfig } from "../src/config.ts";
import { redactString } from "../src/redaction.ts";
import { createCircleWalletReadOnlyGateway, formatWalletInfo, getConfiguredWalletInfo } from "../src/wallet-operations.ts";

try {
  if (process.argv.length > 2) throw new TypeError(`Unsupported argument(s): ${process.argv.slice(2).join(", ")}`);
  const wallet = parseCircleDeploymentConfig(process.env);
  const gateway = createCircleWalletReadOnlyGateway(createDeveloperControlledWalletsClient(parseCircleClientConfig(process.env)));
  for (const line of formatWalletInfo(await getConfiguredWalletInfo({ gateway, configuredWalletId: wallet.deployerWalletId, configuredAddress: wallet.deployerAddress }))) console.log(line);
} catch (error) {
  console.error(redactString(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}