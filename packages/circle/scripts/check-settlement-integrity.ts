import { checkSettlementIntegrity, formatSettlementIntegrityReport, parseSettlementIntegrityConfig } from "../src/settlement-integrity.ts";
import { redactString } from "../src/redaction.ts";

try {
  const config = parseSettlementIntegrityConfig(process.env);
  const report = await checkSettlementIntegrity({ config });
  console.log(formatSettlementIntegrityReport(report));
} catch (error) {
  console.error(redactString(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}