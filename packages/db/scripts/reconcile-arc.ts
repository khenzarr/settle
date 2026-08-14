import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import { createHttpSettlementRpcTransport, parseArcTestnetRpcUrl } from "@settle/shared";

import { ArcReconciliationWorker } from "../src/arc-reconciliation-worker.ts";
import { createDatabaseClient } from "../src/client.ts";
import { parseArcReconciliationConfig } from "../src/reconciliation-policy.ts";

const rawRuns = process.argv.find((argument) => argument.startsWith("--runs="))?.slice("--runs=".length) ?? "1";
const runs = Number(rawRuns);
if (!Number.isInteger(runs) || runs < 1 || runs > 100) throw new RangeError("--runs must be an integer from 1 to 100");

const client = createDatabaseClient(process.env);
try {
  const workerId = `${hostname().slice(0, 40)}:${process.pid}:${randomUUID().slice(0, 8)}`;
  const worker = new ArcReconciliationWorker(client.db, parseArcReconciliationConfig(process.env), createHttpSettlementRpcTransport(parseArcTestnetRpcUrl(process.env)));
  const results = [];
  for (let index = 0; index < runs; index += 1) {
    const result = await worker.runOnce(workerId);
    results.push(result);
    if (result.status === "idle" || result.status === "caught_up") break;
  }
  console.log(JSON.stringify({ runs: results.length, results }));
} finally {
  await client.close();
}
