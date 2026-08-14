import { parseArcReconciliationConfig } from "../src/reconciliation-policy.ts";

const config = parseArcReconciliationConfig(process.env);
console.log(`Arc reconciliation chain: ${config.chainId}`);
console.log("Arc reconciliation contract: canonical Settle deployment");
console.log(`Arc reconciliation deployment block: ${config.deploymentBlock}`);
console.log(`Arc reconciliation confirmations: ${config.confirmationDepth}`);
console.log(`Arc reconciliation chunk size: ${config.chunkSize}`);
console.log(`Arc reconciliation maximum blocks per run: ${config.maxBlocksPerRun}`);
console.log("Arc reconciliation configuration is valid; no RPC or database request was made.");
