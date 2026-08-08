import { formatDemoReadinessReport, inspectDemoReadiness } from "../lib/demo-readiness.ts";

const report = await inspectDemoReadiness(process.env, { production: process.env.NODE_ENV === "production" });
console.log(formatDemoReadinessReport(report));
process.exitCode = report.corePaymentReadiness === "BLOCKER" ? 1 : 0;
