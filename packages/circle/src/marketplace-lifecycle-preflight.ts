import { keccak_256 } from "@noble/hashes/sha3.js";
import {
  ARC_TESTNET,
  OrderStatus,
  ZERO_BYTES32,
  calculateSettlementPayouts,
  createApproveUsdcPlan,
  createCreateOrderPlan,
  createFundOrderPlan,
  createReleaseOrderPlan,
  createSettlementEscrowReader,
  formatUsdcAmount,
  nonZeroEvmAddressSchema,
  normalizeAddress,
  orderIdSchema,
  parseArcTestnetRpcUrl,
  parseUsdcAmount,
  prepareBuyerTransactionIntent,
  settlementEscrowAbi,
  termsHashSchema,
  type BuyerTransactionIntent,
  type EvmAddress,
  type OrderId,
  type SettlementEscrowReader,
  type SettlementRpcTransport,
  type TermsHash,
} from "@settle/shared";

import { readNonEmptyEnvironmentValue, type EnvironmentValues } from "./config.ts";
import { prepareOperatorSettlementExecution, type OperatorSettlementExecutionPreparation } from "./operator-settlement-plan.ts";

export const MARKETPLACE_PREFLIGHT_RPC_METHODS = ["eth_chainId", "eth_getCode", "eth_getBalance", "eth_call"] as const;
export type MarketplacePreflightRpcMethod = (typeof MARKETPLACE_PREFLIGHT_RPC_METHODS)[number];

const FUNDING_DEADLINE_OFFSET_SECONDS = 2n * 60n * 60n;
const SETTLEMENT_DEADLINE_OFFSET_SECONDS = 24n * 60n * 60n;
const WORD = /^0x[0-9a-fA-F]{64}$/;
const HEX_DATA = /^0x(?:[0-9a-fA-F]{2})*$/;
const INTEGER = /^\d+$/;

const ERC20_READ_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

export interface MarketplaceLifecyclePreflightArguments {
  readonly runId: string;
  readonly buyer: string;
  readonly recipientA: string;
  readonly recipientABps: number;
  readonly recipientB: string;
  readonly recipientBBps: number;
  readonly amountUsdc: string;
}

export interface NormalizedMarketplaceLifecycleInput {
  readonly runId: string;
  readonly buyer: EvmAddress;
  readonly amountBaseUnits: bigint;
  readonly amountUsdc: string;
  readonly recipients: readonly [
    { readonly address: EvmAddress; readonly bps: number },
    { readonly address: EvmAddress; readonly bps: number },
  ];
}

export interface MarketplacePreflightRpcTransport extends SettlementRpcTransport {
  request(method: MarketplacePreflightRpcMethod, params: readonly unknown[]): Promise<unknown>;
}

export interface MarketplaceArcReadGateway {
  readChainId(): Promise<bigint>;
  readRuntimeCode(address: EvmAddress): Promise<string>;
  readPaused(contractAddress: EvmAddress): Promise<boolean>;
  readSettlementToken(contractAddress: EvmAddress): Promise<EvmAddress>;
  readOperatorRole(contractAddress: EvmAddress, operatorAddress: EvmAddress): Promise<boolean>;
  readNativeBalance(account: EvmAddress): Promise<bigint>;
  readAllowance(tokenAddress: EvmAddress, owner: EvmAddress, spender: EvmAddress): Promise<bigint>;
}

export interface MarketplaceLifecyclePreflightDependencies {
  readonly settlementReader: SettlementEscrowReader;
  readonly arcReader: MarketplaceArcReadGateway;
  readonly now?: () => bigint;
}

export type MarketplacePreflightReason =
  | "WRONG_CHAIN"
  | "SETTLEMENT_ESCROW_RUNTIME_MISSING"
  | "SETTLEMENT_ESCROW_PAUSED"
  | "WRONG_SETTLEMENT_TOKEN"
  | "OPERATOR_ROLE_MISSING"
  | "ORDER_ID_ALREADY_EXISTS"
  | "BUYER_USDC_INSUFFICIENT"
  | "BUYER_NATIVE_BALANCE_ZERO"
  | "LIFECYCLE_PREPARATION_FAILED"
  | "READ_CHECK_FAILED";

export interface MarketplaceLifecyclePreflightManifest {
  readonly kind: "settle-marketplace-lifecycle-preflight";
  readonly runId: string;
  readonly orderId: OrderId;
  readonly termsHash: TermsHash;
  readonly buyer: EvmAddress;
  readonly amount: { readonly baseUnits: string; readonly usdc: string };
  readonly recipients: readonly {
    readonly address: EvmAddress;
    readonly bps: number;
    readonly expectedPayoutBaseUnits: string;
    readonly expectedPayoutUsdc: string;
    readonly startingUsdcBalanceBaseUnits: string;
    readonly startingUsdcBalanceUsdc: string;
  }[];
  readonly deadlines: { readonly funding: string; readonly settlement: string };
  readonly checks: {
    readonly arcTestnetChainId: boolean;
    readonly settlementEscrowRuntimeExists: boolean;
    readonly settlementEscrowPaused: boolean | null;
    readonly canonicalSettlementToken: boolean;
    readonly operatorRolePresent: boolean;
    readonly orderExists: boolean;
  };
  readonly currentState: {
    readonly allowanceBaseUnits: string;
    readonly allowanceUsdc: string;
    readonly buyerCanonicalUsdcBalanceBaseUnits: string;
    readonly buyerCanonicalUsdcBalanceUsdc: string;
    readonly buyerNativeArcBalanceBaseUnits: string;
    readonly totalActiveEscrowBaseUnits: string;
    readonly totalActiveEscrowUsdc: string;
  };
  readonly expectedTransitions: readonly ["None -> Created", "Created -> Funded", "Funded -> Completed"];
  readonly expectedActiveEscrowDelta: {
    readonly afterFundBaseUnits: string;
    readonly afterReleaseBaseUnits: string;
  };
  readonly preparations: {
    readonly createOperator: OperatorPreparationSummary | null;
    readonly approveBuyer: BuyerIntentSummary | null;
    readonly fundBuyer: BuyerIntentSummary | null;
    readonly releaseOperator: OperatorPreparationSummary | null;
  };
  readonly readiness: { readonly status: "READY" | "NOT READY"; readonly reasons: readonly MarketplacePreflightReason[] };
}

interface OperatorPreparationSummary {
  readonly operation: string;
  readonly operatorSigner: EvmAddress;
  readonly contractAddress: EvmAddress;
  readonly abiFunctionSignature: string;
  readonly parameterCount: number;
  readonly executionRequired: false;
}

interface BuyerIntentSummary {
  readonly operation: string;
  readonly chainId: number;
  readonly from: EvmAddress;
  readonly to: EvmAddress;
  readonly value: "0";
  readonly summary: string;
  readonly prerequisiteKinds: readonly string[];
}

export function parseMarketplaceLifecyclePreflightArguments(args: readonly string[]): MarketplaceLifecyclePreflightArguments {
  const values = new Map<string, string>();
  const supported = new Set(["--run-id", "--buyer", "--recipient-a", "--recipient-a-bps", "--recipient-b", "--recipient-b-bps", "--amount-usdc"]);
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (name === undefined || !supported.has(name)) throw new TypeError(`Unsupported marketplace preflight argument: ${String(name)}`);
    if (value === undefined || value.startsWith("--")) throw new TypeError(`Marketplace preflight argument ${name} requires one value`);
    if (values.has(name)) throw new TypeError(`Marketplace preflight argument ${name} may only be supplied once`);
    values.set(name, value);
  }
  const required = (name: string): string => {
    const value = values.get(name);
    if (value === undefined) throw new TypeError(`Missing required marketplace preflight argument: ${name}`);
    return value;
  };
  return {
    runId: required("--run-id"),
    buyer: required("--buyer"),
    recipientA: required("--recipient-a"),
    recipientABps: parseBps(required("--recipient-a-bps"), "recipient A BPS"),
    recipientB: required("--recipient-b"),
    recipientBBps: parseBps(required("--recipient-b-bps"), "recipient B BPS"),
    amountUsdc: required("--amount-usdc"),
  };
}

export function normalizeMarketplaceLifecycleInput(input: MarketplaceLifecyclePreflightArguments): NormalizedMarketplaceLifecycleInput {
  const runId = input.runId.trim();
  if (runId.length === 0) throw new TypeError("Run ID must be non-empty");
  const buyer = address(input.buyer);
  const recipientA = address(input.recipientA);
  const recipientB = address(input.recipientB);
  if (recipientA === recipientB) throw new TypeError("Marketplace preflight requires exactly two distinct recipients");
  if (!Number.isInteger(input.recipientABps) || input.recipientABps <= 0 || !Number.isInteger(input.recipientBBps) || input.recipientBBps <= 0) {
    throw new TypeError("Recipient BPS values must be positive integers");
  }
  if (input.recipientABps + input.recipientBBps !== 10_000) throw new TypeError("Recipient A BPS and recipient B BPS must total 10000");
  const amountBaseUnits = parseUsdcAmount(input.amountUsdc);
  const recipients: NormalizedMarketplaceLifecycleInput["recipients"] = Object.freeze([
    Object.freeze({ address: recipientA, bps: input.recipientABps }),
    Object.freeze({ address: recipientB, bps: input.recipientBBps }),
  ]);
  return Object.freeze({
    runId,
    buyer,
    amountBaseUnits,
    amountUsdc: formatUsdcAmount(amountBaseUnits),
    recipients,
  });
}

export function deriveMarketplaceOrderId(runId: string): OrderId {
  const normalized = runId.trim();
  if (normalized.length === 0) throw new TypeError("Run ID must be non-empty");
  return orderIdSchema.parse(hashUtf8(canonicalFields("settle.marketplace-demo.order-id.v1", [["runId", normalized]])));
}

export function deriveMarketplaceTermsHash(input: NormalizedMarketplaceLifecycleInput): TermsHash {
  return termsHashSchema.parse(hashUtf8(canonicalFields("settle.marketplace-demo.terms.v1", [
    ["runId", input.runId],
    ["buyer", input.buyer],
    ["amountBaseUnits", input.amountBaseUnits.toString()],
    ["recipientA", input.recipients[0].address],
    ["recipientABps", input.recipients[0].bps.toString()],
    ["recipientB", input.recipients[1].address],
    ["recipientBBps", input.recipients[1].bps.toString()],
  ])));
}

export function parseMarketplaceLifecyclePreflightEnvironment(environment: EnvironmentValues): {
  readonly rpcUrl: string;
  readonly operatorAddress: EvmAddress;
  readonly circleWalletAddress: EvmAddress;
} {
  return {
    rpcUrl: parseArcTestnetRpcUrl(environment),
    operatorAddress: requiredEnvironmentAddress(environment, "SETTLE_OPERATOR_ADDRESS"),
    circleWalletAddress: requiredEnvironmentAddress(environment, "CIRCLE_DEPLOYER_ADDRESS"),
  };
}

export function createMarketplacePreflightRpcTransport(rpcUrl: string, fetcher: typeof globalThis.fetch = globalThis.fetch): MarketplacePreflightRpcTransport {
  const url = new URL(rpcUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new TypeError("Arc RPC URL must use HTTP or HTTPS");
  let nextId = 1;
  return Object.freeze({
    async request(method: MarketplacePreflightRpcMethod, params: readonly unknown[]): Promise<unknown> {
      if (!MARKETPLACE_PREFLIGHT_RPC_METHODS.includes(method)) throw new TypeError(`Marketplace preflight refuses RPC method ${method}`);
      let response: Response;
      try {
        response = await fetcher(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }) });
      } catch {
        throw new TypeError(`Arc Testnet RPC ${method} request failed`);
      }
      if (!response.ok) throw new TypeError(`Arc Testnet RPC ${method} failed with HTTP ${response.status}`);
      const body = await response.json() as Readonly<{ result?: unknown; error?: unknown }>;
      if (body.error !== undefined || !("result" in body)) throw new TypeError(`Arc Testnet RPC ${method} returned an error`);
      return body.result;
    },
  });
}

export function createMarketplaceArcReadGateway(transport: MarketplacePreflightRpcTransport): MarketplaceArcReadGateway {
  const call = async (to: EvmAddress, data: string): Promise<unknown> => transport.request("eth_call", [{ to, data }, "latest"]);
  const gateway: MarketplaceArcReadGateway = {
    async readChainId() { return rpcQuantity(await transport.request("eth_chainId", []), "chain ID"); },
    async readRuntimeCode(contractAddress) { return rpcData(await transport.request("eth_getCode", [contractAddress, "latest"]), "runtime code"); },
    async readPaused(contractAddress) { return decodeBool(await call(contractAddress, functionData("paused"))); },
    async readSettlementToken(contractAddress) { return decodeAddress(await call(contractAddress, functionData("usdc"))); },
    async readOperatorRole(contractAddress, operatorAddress) {
      const role = decodeWord(await call(contractAddress, functionData("OPERATOR_ROLE")));
      return decodeBool(await call(contractAddress, functionData("hasRole", [role, operatorAddress])));
    },
    async readNativeBalance(account) { return rpcQuantity(await transport.request("eth_getBalance", [account, "latest"]), "native balance"); },
    async readAllowance(tokenAddress, owner, spender) { return decodeUint(await call(tokenAddress, functionData("allowance", [owner, spender]))); },
  };
  return Object.freeze(gateway);
}

export function createMarketplaceLifecyclePreflightDependencies(input: Readonly<{
  rpcUrl: string;
  fetch?: typeof globalThis.fetch;
  now?: () => bigint;
}>): MarketplaceLifecyclePreflightDependencies {
  const transport = createMarketplacePreflightRpcTransport(input.rpcUrl, input.fetch);
  return {
    settlementReader: createSettlementEscrowReader({ transport }),
    arcReader: createMarketplaceArcReadGateway(transport),
    ...(input.now === undefined ? {} : { now: input.now }),
  };
}

export async function preflightMarketplaceLifecycle(input: Readonly<{
  arguments: MarketplaceLifecyclePreflightArguments;
  operatorAddress: string;
  circleWalletAddress: string;
  dependencies: MarketplaceLifecyclePreflightDependencies;
}>): Promise<MarketplaceLifecyclePreflightManifest> {
  const normalized = normalizeMarketplaceLifecycleInput(input.arguments);
  const operator = address(input.operatorAddress);
  const circleWallet = address(input.circleWalletAddress);
  const orderId = deriveMarketplaceOrderId(normalized.runId);
  const termsHash = deriveMarketplaceTermsHash(normalized);
  const now = input.dependencies.now?.() ?? BigInt(Math.floor(Date.now() / 1_000));
  if (now < 0n) throw new RangeError("Current Unix timestamp cannot be negative");
  const fundingDeadline = now + FUNDING_DEADLINE_OFFSET_SECONDS;
  const settlementDeadline = now + SETTLEMENT_DEADLINE_OFFSET_SECONDS;
  const splits = normalized.recipients.map((recipient) => ({ recipient: recipient.address, shareBps: recipient.bps }));
  const payouts = calculateSettlementPayouts(normalized.amountBaseUnits, splits);
  const reasons = new Set<MarketplacePreflightReason>();

  let createOperator: OperatorPreparationSummary | null = null;
  let approveBuyer: BuyerIntentSummary | null = null;
  let fundBuyer: BuyerIntentSummary | null = null;
  let releaseOperator: OperatorPreparationSummary | null = null;
  try {
    const createPlan = createCreateOrderPlan({ operatorAddress: operator, currentTimestamp: now, orderId, buyer: normalized.buyer, totalAmountUsdc: normalized.amountUsdc, fundingDeadline, settlementDeadline, termsHash, splits });
    const createdOrder = { orderId, buyer: normalized.buyer, totalAmount: normalized.amountBaseUnits, status: OrderStatus.Created } as const;
    const approvePlan = createApproveUsdcPlan({ order: createdOrder });
    const fundPlan = createFundOrderPlan({ order: createdOrder });
    const releasePlan = createReleaseOrderPlan({ operatorAddress: operator, order: { ...createdOrder, status: OrderStatus.Funded }, splits });
    createOperator = summarizeOperator(prepareOperatorSettlementExecution({ plan: createPlan, configuredWalletAddress: circleWallet, configuredOperatorAddress: operator }));
    approveBuyer = summarizeBuyer(prepareBuyerTransactionIntent(approvePlan));
    fundBuyer = summarizeBuyer(prepareBuyerTransactionIntent(fundPlan));
    releaseOperator = summarizeOperator(prepareOperatorSettlementExecution({ plan: releasePlan, configuredWalletAddress: circleWallet, configuredOperatorAddress: operator }));
  } catch {
    reasons.add("LIFECYCLE_PREPARATION_FAILED");
  }

  let chainOk = false;
  let runtimeExists = false;
  let paused: boolean | null = null;
  let tokenOk = false;
  let operatorRole = false;
  let orderExists = false;
  let allowance = 0n;
  let buyerUsdc = 0n;
  let buyerNative = 0n;
  let totalActiveEscrow = 0n;
  let recipientBalances: readonly [bigint, bigint] = [0n, 0n];
  try {
    chainOk = await input.dependencies.arcReader.readChainId() === BigInt(ARC_TESTNET.chainId);
    if (!chainOk) reasons.add("WRONG_CHAIN");
    const runtime = await input.dependencies.arcReader.readRuntimeCode(ARC_TESTNET.settlementEscrow.address);
    runtimeExists = runtime !== "0x" && !/^0x0*$/.test(runtime);
    if (!runtimeExists) reasons.add("SETTLEMENT_ESCROW_RUNTIME_MISSING");
    paused = await input.dependencies.arcReader.readPaused(ARC_TESTNET.settlementEscrow.address);
    if (paused) reasons.add("SETTLEMENT_ESCROW_PAUSED");
    tokenOk = await input.dependencies.arcReader.readSettlementToken(ARC_TESTNET.settlementEscrow.address) === ARC_TESTNET.usdc.address;
    if (!tokenOk) reasons.add("WRONG_SETTLEMENT_TOKEN");
    operatorRole = await input.dependencies.arcReader.readOperatorRole(ARC_TESTNET.settlementEscrow.address, operator);
    if (!operatorRole) reasons.add("OPERATOR_ROLE_MISSING");
    const order = await input.dependencies.settlementReader.readSettlementOrder(orderId);
    orderExists = order.exists;
    if (orderExists) reasons.add("ORDER_ID_ALREADY_EXISTS");
    [allowance, buyerUsdc, buyerNative, totalActiveEscrow, recipientBalances] = await Promise.all([
      input.dependencies.arcReader.readAllowance(ARC_TESTNET.usdc.address, normalized.buyer, ARC_TESTNET.settlementEscrow.address),
      input.dependencies.settlementReader.readUsdcBalance(normalized.buyer),
      input.dependencies.arcReader.readNativeBalance(normalized.buyer),
      input.dependencies.settlementReader.readTotalActiveEscrow(),
      Promise.all(normalized.recipients.map((recipient) => input.dependencies.settlementReader.readUsdcBalance(recipient.address))) as Promise<[bigint, bigint]>,
    ]);
    if (buyerUsdc < normalized.amountBaseUnits) reasons.add("BUYER_USDC_INSUFFICIENT");
    if (buyerNative === 0n) reasons.add("BUYER_NATIVE_BALANCE_ZERO");
  } catch {
    reasons.add("READ_CHECK_FAILED");
  }

  return {
    kind: "settle-marketplace-lifecycle-preflight",
    runId: normalized.runId,
    orderId,
    termsHash,
    buyer: normalized.buyer,
    amount: { baseUnits: normalized.amountBaseUnits.toString(), usdc: normalized.amountUsdc },
    recipients: normalized.recipients.map((recipient, index) => ({
      address: recipient.address,
      bps: recipient.bps,
      expectedPayoutBaseUnits: payouts[index]!.toString(),
      expectedPayoutUsdc: formatUsdcAmount(payouts[index]!),
      startingUsdcBalanceBaseUnits: recipientBalances[index]!.toString(),
      startingUsdcBalanceUsdc: formatUsdcAmount(recipientBalances[index]!),
    })),
    deadlines: { funding: fundingDeadline.toString(), settlement: settlementDeadline.toString() },
    checks: { arcTestnetChainId: chainOk, settlementEscrowRuntimeExists: runtimeExists, settlementEscrowPaused: paused, canonicalSettlementToken: tokenOk, operatorRolePresent: operatorRole, orderExists },
    currentState: {
      allowanceBaseUnits: allowance.toString(), allowanceUsdc: formatUsdcAmount(allowance),
      buyerCanonicalUsdcBalanceBaseUnits: buyerUsdc.toString(), buyerCanonicalUsdcBalanceUsdc: formatUsdcAmount(buyerUsdc),
      buyerNativeArcBalanceBaseUnits: buyerNative.toString(), totalActiveEscrowBaseUnits: totalActiveEscrow.toString(), totalActiveEscrowUsdc: formatUsdcAmount(totalActiveEscrow),
    },
    expectedTransitions: ["None -> Created", "Created -> Funded", "Funded -> Completed"],
    expectedActiveEscrowDelta: { afterFundBaseUnits: normalized.amountBaseUnits.toString(), afterReleaseBaseUnits: `-${normalized.amountBaseUnits.toString()}` },
    preparations: { createOperator, approveBuyer, fundBuyer, releaseOperator },
    readiness: { status: reasons.size === 0 ? "READY" : "NOT READY", reasons: [...reasons] },
  };
}

function summarizeOperator(preparation: OperatorSettlementExecutionPreparation): OperatorPreparationSummary {
  return { operation: preparation.operation, operatorSigner: preparation.operatorSigner, contractAddress: preparation.contractAddress, abiFunctionSignature: preparation.abiFunctionSignature, parameterCount: preparation.parameterCount, executionRequired: false };
}

function summarizeBuyer(intent: BuyerTransactionIntent): BuyerIntentSummary {
  return { operation: intent.operation, chainId: intent.chainId, from: intent.from, to: intent.to, value: "0", summary: intent.summary, prerequisiteKinds: intent.prerequisites.map((item) => item.kind) };
}

function canonicalFields(domain: string, fields: readonly (readonly [string, string])[]): string {
  return [domain, ...fields.map(([name, value]) => `${name.length}:${name}:${new TextEncoder().encode(value).length}:${value}`)].join("\n");
}

function hashUtf8(value: string): `0x${string}` {
  const hash = `0x${Array.from(keccak_256(new TextEncoder().encode(value)), (byte) => byte.toString(16).padStart(2, "0")).join("")}` as const;
  if (hash === ZERO_BYTES32) throw new TypeError("Deterministic identifier unexpectedly resolved to zero bytes32");
  return hash;
}

function parseBps(value: string, label: string): number {
  if (!INTEGER.test(value)) throw new TypeError(`${label} must be a positive integer`);
  return Number(value);
}

function address(value: string): EvmAddress {
  return normalizeAddress(nonZeroEvmAddressSchema.parse(value));
}

function requiredEnvironmentAddress(environment: EnvironmentValues, name: string): EvmAddress {
  const value = readNonEmptyEnvironmentValue(environment, name);
  if (value === undefined) throw new TypeError(`Missing required marketplace preflight environment field: ${name}`);
  return address(value);
}

function functionData(name: string, args: readonly string[] = []): string {
  const entries = [...settlementEscrowAbi, ...ERC20_READ_ABI].filter((entry): entry is Extract<typeof entry, { type: "function" }> => entry.type === "function" && entry.name === name);
  if (entries.length !== 1) throw new TypeError(`Expected exactly one read ABI function named ${name}`);
  const entry = entries[0]!;
  if (entry.stateMutability !== "view") throw new TypeError(`Marketplace preflight refuses non-view ABI function ${name}`);
  const signature = `${entry.name}(${entry.inputs.map((item) => item.type).join(",")})`;
  const selector = hashUtf8(signature).slice(2, 10);
  return `0x${selector}${args.map(encodeWord).join("")}`;
}

function encodeWord(value: string): string {
  if (WORD.test(value)) return value.slice(2).toLowerCase();
  return address(value).slice(2).padStart(64, "0");
}

function decodeWord(value: unknown): `0x${string}` {
  if (typeof value !== "string" || !WORD.test(value)) throw new TypeError("Arc Testnet eth_call returned invalid 32-byte data");
  return value.toLowerCase() as `0x${string}`;
}

function decodeUint(value: unknown): bigint { return BigInt(decodeWord(value)); }
function decodeBool(value: unknown): boolean {
  const result = decodeUint(value);
  if (result !== 0n && result !== 1n) throw new TypeError("Arc Testnet eth_call returned an invalid boolean");
  return result === 1n;
}
function decodeAddress(value: unknown): EvmAddress {
  const word = decodeWord(value);
  if (!/^0x0{24}[0-9a-f]{40}$/.test(word)) throw new TypeError("Arc Testnet eth_call returned an invalid address");
  return address(`0x${word.slice(-40)}`);
}
function rpcQuantity(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) throw new TypeError(`Arc Testnet RPC returned an invalid ${label}`);
  return BigInt(value);
}
function rpcData(value: unknown, label: string): string {
  if (typeof value !== "string" || !HEX_DATA.test(value)) throw new TypeError(`Arc Testnet RPC returned invalid ${label}`);
  return value.toLowerCase();
}