import {
  ARC_TESTNET,
  ARC_TESTNET_RPC_URL_ENV,
  NEXT_PUBLIC_ARC_TESTNET_RPC_URL_ENV,
  OrderStatus,
  SETTLEMENT_ORDER_EVENT_KINDS,
  createHttpSettlementRpcTransport,
  createSettlementEscrowReader,
  parseArcTestnetRpcUrl,
  settlementEscrowAbi,
  type EnvironmentValues,
  type SettlementRpcTransport,
} from "@settle/shared";
import { encodeEventTopics } from "viem";

import { parsePublicAppOrigin, PublicAppOriginError } from "./public-app-origin.server.ts";

export const DEMO_ORDER_ID = "0x221c314b3d80445868b1aeec7f5ebdbaf50fd48c320245659b689b7a4fca1765" as const;
export const DEMO_EVIDENCE_FROM_BLOCK = 55_852_736n;
export const DEMO_EVIDENCE_TO_BLOCK = 55_856_911n;

export const DEMO_READINESS_RPC_METHODS = [
  "eth_chainId",
  "eth_getCode",
  "eth_call",
  "eth_blockNumber",
  "eth_getLogs",
] as const;

export type ReadinessState = "PASS" | "DEGRADED" | "BLOCKER";
export type ProbeState = "PASS" | "FAIL";

export interface DemoReadinessReport {
  readonly rpcSource: "configured override" | "canonical fallback";
  readonly chainId: string | null;
  readonly chain: ProbeState;
  readonly contractCode: ProbeState;
  readonly canonicalRead: ProbeState;
  readonly canonicalStatus: string | null;
  readonly latestBlock: ProbeState;
  readonly evidenceLogRead: "PASS" | "DEGRADED";
  readonly corePaymentReadiness: "PASS" | "BLOCKER";
  readonly lifecycleEvidence: "PASS" | "DEGRADED";
  readonly qrReadiness: "PASS" | "DEGRADED";
  readonly publicOrigin: string | null;
  readonly overall: ReadinessState;
}

function nonEmpty(values: EnvironmentValues, name: string): boolean {
  return values[name]?.trim() !== undefined && values[name]!.trim() !== "";
}

function quantity(value: unknown): bigint {
  if (typeof value !== "string" || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) {
    throw new TypeError("Invalid RPC quantity");
  }
  return BigInt(value);
}

function hasRuntimeCode(value: unknown): boolean {
  return typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value) && !/^0x0*$/.test(value);
}

function evidenceTopics() {
  const eventTopics = SETTLEMENT_ORDER_EVENT_KINDS.map((eventName) => (
    encodeEventTopics({ abi: settlementEscrowAbi, eventName: eventName as never })[0]
  ));
  const orderTopic = encodeEventTopics({
    abi: settlementEscrowAbi,
    eventName: "OrderCreated",
    args: { orderId: DEMO_ORDER_ID },
  })[1];
  return [eventTopics, orderTopic] as const;
}

export function formatDemoReadinessReport(report: DemoReadinessReport): string {
  return [
    "Settle grant demo readiness (read-only)",
    `RPC source: ${report.rpcSource}`,
    `Chain ID: ${report.chainId ?? "unavailable"}`,
    `Chain read: ${report.chain}`,
    `Contract code read: ${report.contractCode}`,
    `Canonical demo-002 read: ${report.canonicalRead}`,
    `Canonical status: ${report.canonicalStatus ?? "unavailable"}`,
    `Latest block read: ${report.latestBlock}`,
    `Evidence log read: ${report.evidenceLogRead}`,
    `Public origin: ${report.publicOrigin === null ? "unavailable" : "configured"}`,
    `QR readiness: ${report.qrReadiness}`,
    `CORE PAYMENT READINESS: ${report.corePaymentReadiness}`,
    `LIFECYCLE EVIDENCE: ${report.lifecycleEvidence}`,
    `OVERALL: ${report.overall}`,
  ].join("\n");
}

export async function inspectDemoReadiness(
  values: EnvironmentValues,
  options: { readonly transport?: SettlementRpcTransport; readonly production?: boolean } = {},
): Promise<DemoReadinessReport> {
  const rpcSource = nonEmpty(values, ARC_TESTNET_RPC_URL_ENV) || nonEmpty(values, NEXT_PUBLIC_ARC_TESTNET_RPC_URL_ENV)
    ? "configured override"
    : "canonical fallback";
  const transport = options.transport ?? createHttpSettlementRpcTransport(parseArcTestnetRpcUrl(values));
  const reader = createSettlementEscrowReader({ transport });

  let chainId: string | null = null;
  let chain: ProbeState = "FAIL";
  try {
    const parsed = quantity(await transport.request("eth_chainId", []));
    chainId = parsed.toString();
    chain = parsed === BigInt(ARC_TESTNET.chainId) ? "PASS" : "FAIL";
  } catch {}

  let contractCode: ProbeState = "FAIL";
  try {
    contractCode = hasRuntimeCode(await transport.request("eth_getCode", [ARC_TESTNET.settlementEscrow.address, "latest"])) ? "PASS" : "FAIL";
  } catch {}

  let canonicalRead: ProbeState = "FAIL";
  let canonicalStatus: string | null = null;
  try {
    const result = await reader.readSettlementOrderProjection(DEMO_ORDER_ID);
    if (result.kind === "known") {
      canonicalStatus = result.projection.statusLabel;
      canonicalRead = result.projection.status === OrderStatus.Completed ? "PASS" : "FAIL";
    }
  } catch {}

  let latestBlock: ProbeState = "FAIL";
  try {
    quantity(await transport.request("eth_blockNumber", []));
    latestBlock = "PASS";
  } catch {}

  let evidenceLogRead: "PASS" | "DEGRADED" = "DEGRADED";
  try {
    const logs = await transport.request("eth_getLogs", [{
      address: ARC_TESTNET.settlementEscrow.address,
      fromBlock: `0x${DEMO_EVIDENCE_FROM_BLOCK.toString(16)}`,
      toBlock: `0x${DEMO_EVIDENCE_TO_BLOCK.toString(16)}`,
      topics: evidenceTopics(),
    }]);
    evidenceLogRead = Array.isArray(logs) && logs.length > 0 ? "PASS" : "DEGRADED";
  } catch {}

  let publicOrigin: string | null = null;
  try {
    publicOrigin = parsePublicAppOrigin(values, { allowInsecureLocalhost: options.production !== true });
  } catch (cause) {
    if (!(cause instanceof PublicAppOriginError)) throw cause;
  }

  const corePaymentReadiness = chain === "PASS" && contractCode === "PASS" && canonicalRead === "PASS" ? "PASS" : "BLOCKER";
  const lifecycleEvidence = latestBlock === "PASS" && evidenceLogRead === "PASS" ? "PASS" : "DEGRADED";
  const qrReadiness = publicOrigin === null ? "DEGRADED" : "PASS";
  const overall = corePaymentReadiness === "BLOCKER"
    ? "BLOCKER"
    : lifecycleEvidence === "DEGRADED" || qrReadiness === "DEGRADED"
      ? "DEGRADED"
      : "PASS";

  return {
    rpcSource,
    chainId,
    chain,
    contractCode,
    canonicalRead,
    canonicalStatus,
    latestBlock,
    evidenceLogRead,
    corePaymentReadiness,
    lifecycleEvidence,
    qrReadiness,
    publicOrigin,
    overall,
  };
}
