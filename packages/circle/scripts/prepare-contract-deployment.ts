import { parseCircleDeploymentConfig } from "../src/config.ts";
import { createPublicationSafeDeploymentSummary, prepareSettlementEscrowDeployment } from "../src/contracts.ts";
import { redactString } from "../src/redaction.ts";

try {
  if (process.argv.length > 2) throw new TypeError(`Unsupported argument(s): ${process.argv.slice(2).join(", ")}`);
  const config = parseCircleDeploymentConfig(process.env);
  const preparation = await prepareSettlementEscrowDeployment(config);
  const summary = createPublicationSafeDeploymentSummary(preparation);

  console.log("Circle Contracts deployment preparation (no submission):");
  console.log(`contract name: ${summary.contractName}`);
  console.log(`blockchain: ${summary.blockchain}`);
  console.log(`deployer wallet ID: ${summary.deployerWalletId}`);
  console.log(`deployer address: ${summary.deployerAddress}`);
  console.log(`bytecode length: ${summary.bytecodeLength} bytes`);
  console.log(`ABI entry count: ${summary.abiEntryCount}`);
  console.log(`administrator address: ${summary.constructorRoles.administratorAddress}`);
  console.log(`operator address: ${summary.constructorRoles.operatorAddress}`);
  console.log(`arbitrator address: ${summary.constructorRoles.arbitratorAddress}`);
  console.log(`pauser address: ${summary.constructorRoles.pauserAddress}`);
  console.log(`official USDC address: ${summary.officialUsdcAddress}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redactString(message));
  process.exitCode = 1;
}