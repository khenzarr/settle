import { createDeveloperControlledWalletsClient } from "../src/client.ts";
import { parseCircleClientConfig, parseCircleMutationWalletConfig } from "../src/config.ts";
import { redactString } from "../src/redaction.ts";
import { WALLET_TRANSACTION_FAILURE_STATES, createCircleWalletTransactionStatusGateway, formatWalletTransactionStatus, getWalletTransactionStatus, parseWalletTransactionStatusArguments, waitForWalletTransactionStatus } from "../src/wallet-transaction-status.ts";

try {
  const parsed = parseWalletTransactionStatusArguments(process.argv.slice(2));
  const wallet = parseCircleMutationWalletConfig(process.env);
  const gateway = createCircleWalletTransactionStatusGateway(createDeveloperControlledWalletsClient(parseCircleClientConfig(process.env)));
  const retrieve = () => getWalletTransactionStatus({ gateway, requestedTransactionId: parsed.transactionId, configuredWalletId: wallet.deployerWalletId });
  const status = parsed.wait
    ? await waitForWalletTransactionStatus({ retrieve, intervalSeconds: parsed.intervalSeconds, timeoutSeconds: parsed.timeoutSeconds, onChange: (value) => { for (const line of formatWalletTransactionStatus(value)) console.log(line); } })
    : await retrieve();
  if (!parsed.wait) for (const line of formatWalletTransactionStatus(status)) console.log(line);
  if (WALLET_TRANSACTION_FAILURE_STATES.has(status.state as "STUCK" | "FAILED" | "DENIED" | "CANCELLED")) process.exitCode = 1;
} catch (error) {
  console.error(redactString(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}