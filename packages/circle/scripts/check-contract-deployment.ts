import { getExplorerAddressUrl, getExplorerTransactionUrl } from "@settle/shared";
import { createCircleContractsClient, createDeveloperControlledWalletsClient } from "../src/client.ts";
import { parseCircleClientConfig, parseCircleDeploymentReferences } from "../src/config.ts";
import { getContractStatus, getTransactionStatus } from "../src/contract-deployment.ts";
import type { SafeContractStatus, SafeTransactionStatus } from "../src/contract-deployment.ts";
import { parseDeploymentStatusArguments, verifyArcDeploymentBytecode, waitForDeployment } from "../src/deployment-status.ts";
import { redactString } from "../src/redaction.ts";

try {
  const parsed = parseDeploymentStatusArguments(process.argv.slice(2));
  const references = parseCircleDeploymentReferences({
    ...process.env,
    ...(parsed.contractId === undefined ? {} : { CIRCLE_SETTLEMENT_CONTRACT_ID: parsed.contractId }),
    ...(parsed.transactionId === undefined ? {} : { CIRCLE_DEPLOYMENT_TRANSACTION_ID: parsed.transactionId }),
  });
  const contractId = references.contractId;
  const transactionId = references.transactionId;
  if (contractId === undefined || transactionId === undefined) throw new TypeError("Provide both Circle contract and transaction IDs through CLI arguments or optional environment values");
  const config = parseCircleClientConfig(process.env);
  const contractsClient = createCircleContractsClient(config);
  const walletsClient = createDeveloperControlledWalletsClient(config);
  const retrieve = async () => {
    const [contract, transaction] = await Promise.all([getContractStatus(contractsClient, contractId), getTransactionStatus(walletsClient, transactionId)]);
    if (contract.blockchain !== "ARC-TESTNET" || transaction.blockchain !== "ARC-TESTNET") throw new TypeError("Circle deployment records must both refer to ARC-TESTNET");
    if (contract.transactionId !== undefined && contract.transactionId !== transactionId) throw new TypeError("Circle contract deployment transaction ID does not match the configured transaction ID");
    return { ...transaction, contract };
  };
  const status = parsed.wait
    ? await waitForDeployment({ retrieve, intervalSeconds: parsed.intervalSeconds, timeoutSeconds: parsed.timeoutSeconds, onChange: printStatus })
    : await retrieve();
  if (!parsed.wait) printStatus(status);
  if (status.state === "COMPLETE" && status.contract.contractAddress !== undefined) {
    const verified = await verifyArcDeploymentBytecode({ address: status.contract.contractAddress, transactionHash: status.transactionHash ?? status.contract.transactionHash, environment: process.env });
    console.log(`onchain bytecode: present at ${verified.address}`);
    console.log(`ArcScan contract URL: ${verified.contractUrl}`);
    if (verified.transactionUrl !== undefined) console.log(`ArcScan transaction URL: ${verified.transactionUrl}`);
  }
} catch (error) {
  console.error(redactString(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}

type CombinedStatus = SafeTransactionStatus & Readonly<{ contract: SafeContractStatus }>;
function printStatus(status: CombinedStatus): void {
  const contract = status.contract;
  console.log(`contract ID: ${contract.contractId}`);
  console.log(`contract status: ${contract.status}`);
  if (contract.contractAddress !== undefined) { console.log(`contract address: ${contract.contractAddress}`); console.log(`ArcScan contract URL: ${getExplorerAddressUrl(contract.contractAddress)}`); }
  if (contract.verificationStatus !== undefined) console.log(`contract verification status: ${contract.verificationStatus}`);
  if (contract.failureReason !== undefined) console.log(`contract failure reason: ${contract.failureReason}`);
  console.log(`transaction ID: ${status.transactionId}`);
  console.log(`transaction state: ${status.state}`);
  if (status.transactionHash !== undefined) { console.log(`transaction hash: ${status.transactionHash}`); console.log(`ArcScan transaction URL: ${getExplorerTransactionUrl(status.transactionHash)}`); }
  if (status.blockHeight !== undefined) console.log(`block height: ${status.blockHeight}`);
  if (status.networkFee !== undefined) console.log(`network fee: ${status.networkFee}`);
  if (status.failureReason !== undefined) console.log(`transaction failure reason: ${status.failureReason}`);
  if (status.requestId !== undefined) console.log(`transaction request ID: ${status.requestId}`);
  if (contract.requestId !== undefined) console.log(`contract request ID: ${contract.requestId}`);
}