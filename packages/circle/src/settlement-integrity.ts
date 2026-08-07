import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { keccak_256 } from "@noble/hashes/sha3.js";
import {
  ARC_TESTNET,
  USDC_DECIMALS,
  nonZeroEvmAddressSchema,
  normalizeAddress,
  parseArcTestnetRpcUrl,
  settlementEscrowAbi,
} from "@settle/shared";
import type { EvmAddress } from "@settle/shared";
import { readNonEmptyEnvironmentValue } from "./config.ts";
import { SETTLEMENT_ESCROW_ARTIFACT_PATH } from "./contracts.ts";

const DEFAULT_ARTIFACT_PATH = fileURLToPath(
  new URL("../../contracts/out/SettlementEscrow.sol/SettlementEscrow.json", import.meta.url),
);
const HEX_DATA = /^0x(?:[0-9a-fA-F]{2})*$/;
const WORD = /^0x[0-9a-fA-F]{64}$/;
const EXPECTED_CHAIN_ID_HEX = `0x${ARC_TESTNET.chainId.toString(16)}`;

const TOKEN_DECIMALS_ABI = {
  type: "function",
  name: "decimals",
  inputs: [],
  outputs: [{ name: "", type: "uint8" }],
  stateMutability: "view",
} as const;

const ROLE_CHECKS = [
  { getter: "DEFAULT_ADMIN_ROLE", sourceSemantic: "0x" + "00".repeat(32), addressKey: "administratorAddress", label: "administrator" },
  { getter: "OPERATOR_ROLE", sourceSemantic: "OPERATOR_ROLE", addressKey: "operatorAddress", label: "operator" },
  { getter: "ARBITRATOR_ROLE", sourceSemantic: "ARBITRATOR_ROLE", addressKey: "arbitratorAddress", label: "arbitrator" },
  { getter: "PAUSER_ROLE", sourceSemantic: "PAUSER_ROLE", addressKey: "pauserAddress", label: "pauser" },
] as const;

export interface SettlementIntegrityConfig {
  readonly contractAddress: EvmAddress;
  readonly administratorAddress: EvmAddress;
  readonly operatorAddress: EvmAddress;
  readonly arbitratorAddress: EvmAddress;
  readonly pauserAddress: EvmAddress;
  readonly rpcUrl: string;
}

export interface SettlementIntegrityReport {
  readonly blockchain: "Arc Testnet";
  readonly chainId: number;
  readonly contractAddress: EvmAddress;
  readonly runtimeBytecodePresent: true;
  readonly settlementToken: EvmAddress;
  readonly tokenDecimals: number;
  readonly administratorRole: "confirmed";
  readonly operatorRole: "confirmed";
  readonly arbitratorRole: "confirmed";
  readonly pauserRole: "confirmed";
  readonly paused: false;
  readonly totalActiveEscrow: bigint;
  readonly runtimeIntegrity: "exact match after immutable substitution";
}

interface RuntimeArtifact {
  readonly object: string;
  readonly immutableReferences: Readonly<Record<string, readonly Readonly<{ start: number; length: number }>[]>>;
  readonly linkReferences: Readonly<Record<string, unknown>>;
}

export function parseSettlementIntegrityConfig(environment: Readonly<Record<string, string | undefined>>): SettlementIntegrityConfig {
  return {
    contractAddress: readRequiredAddress(environment, "SETTLEMENT_CONTRACT_ADDRESS"),
    administratorAddress: readRequiredAddress(environment, "SETTLE_ADMIN_ADDRESS"),
    operatorAddress: readRequiredAddress(environment, "SETTLE_OPERATOR_ADDRESS"),
    arbitratorAddress: readRequiredAddress(environment, "SETTLE_ARBITRATOR_ADDRESS"),
    pauserAddress: readRequiredAddress(environment, "SETTLE_PAUSER_ADDRESS"),
    rpcUrl: parseArcTestnetRpcUrl(environment),
  };
}

export async function checkSettlementIntegrity(input: Readonly<{
  config: SettlementIntegrityConfig;
  fetch?: typeof globalThis.fetch;
  artifact?: RuntimeArtifact;
}>): Promise<SettlementIntegrityReport> {
  const fetcher = input.fetch ?? globalThis.fetch;
  const { config } = input;
  const chainId = await rpc(fetcher, config.rpcUrl, "eth_chainId", []);
  if (chainId !== EXPECTED_CHAIN_ID_HEX) {
    throw new TypeError(`Expected Arc Testnet chain ID ${ARC_TESTNET.chainId}, received ${formatChainId(chainId)}`);
  }

  const code = await rpc(fetcher, config.rpcUrl, "eth_getCode", [config.contractAddress, "latest"]);
  const runtimeBytecode = readNonEmptyHex(code, "Arc Testnet contract address has empty deployed runtime bytecode");
  const artifact = input.artifact ?? await readRuntimeArtifact(DEFAULT_ARTIFACT_PATH);

  const settlementToken = decodeAddress(await call(fetcher, config.rpcUrl, config.contractAddress, functionData("usdc")));
  if (settlementToken !== normalizeAddress(ARC_TESTNET.usdc.address)) {
    throw new TypeError(`Settlement token mismatch: expected ${ARC_TESTNET.usdc.address}, received ${settlementToken}`);
  }

  const tokenDecimals = Number(decodeUint(await call(fetcher, config.rpcUrl, settlementToken, functionData(TOKEN_DECIMALS_ABI))));
  if (tokenDecimals !== USDC_DECIMALS) {
    throw new TypeError(`Settlement token decimals mismatch: expected ${USDC_DECIMALS}, received ${tokenDecimals}`);
  }

  for (const role of ROLE_CHECKS) {
    const roleIdentifier = decodeWord(await call(fetcher, config.rpcUrl, config.contractAddress, functionData(role.getter)));
    const expectedIdentifier = role.getter === "DEFAULT_ADMIN_ROLE"
      ? role.sourceSemantic
      : `0x${bytesToHex(keccak_256(new TextEncoder().encode(role.sourceSemantic)))}`;
    if (roleIdentifier !== expectedIdentifier) {
      throw new TypeError(`${role.getter} identifier does not match SettlementEscrow source semantics`);
    }
    const account = config[role.addressKey];
    const holdsRole = decodeBool(await call(fetcher, config.rpcUrl, config.contractAddress, functionData("hasRole", [roleIdentifier, account])));
    if (!holdsRole) throw new TypeError(`Expected ${role.label} address does not hold ${role.getter}`);
  }

  const paused = decodeBool(await call(fetcher, config.rpcUrl, config.contractAddress, functionData("paused")));
  if (paused) throw new TypeError("SettlementEscrow deployment is paused");
  const totalActiveEscrow = decodeUint(await call(fetcher, config.rpcUrl, config.contractAddress, functionData("totalActiveEscrow")));
  if (totalActiveEscrow !== 0n) {
    throw new TypeError(`Expected zero initial totalActiveEscrow, received ${totalActiveEscrow.toString()}`);
  }

  compareRuntimeBytecode(runtimeBytecode, artifact, settlementToken);

  return {
    blockchain: "Arc Testnet",
    chainId: ARC_TESTNET.chainId,
    contractAddress: config.contractAddress,
    runtimeBytecodePresent: true,
    settlementToken,
    tokenDecimals,
    administratorRole: "confirmed",
    operatorRole: "confirmed",
    arbitratorRole: "confirmed",
    pauserRole: "confirmed",
    paused: false,
    totalActiveEscrow,
    runtimeIntegrity: "exact match after immutable substitution",
  };
}

export function formatSettlementIntegrityReport(report: SettlementIntegrityReport): string {
  return [
    `blockchain: ${report.blockchain}`,
    `chain ID: ${report.chainId}`,
    `contract address: ${report.contractAddress}`,
    "runtime bytecode present: yes",
    `settlement token: ${report.settlementToken}`,
    `token decimals: ${report.tokenDecimals}`,
    `administrator role: ${report.administratorRole}`,
    `operator role: ${report.operatorRole}`,
    `arbitrator role: ${report.arbitratorRole}`,
    `pauser role: ${report.pauserRole}`,
    `paused: ${report.paused}`,
    `total active escrow: ${report.totalActiveEscrow.toString()}`,
    `runtime integrity: ${report.runtimeIntegrity}`,
  ].join("\n");
}

function functionData(nameOrEntry: string | typeof TOKEN_DECIMALS_ABI, args: readonly string[] = []): string {
  const entry = typeof nameOrEntry === "string" ? findReadFunction(nameOrEntry) : nameOrEntry;
  const signature = `${entry.name}(${entry.inputs.map((input) => input.type).join(",")})`;
  const selector = bytesToHex(keccak_256(new TextEncoder().encode(signature))).slice(0, 8);
  return `0x${selector}${args.map(encodeWord).join("")}`;
}

function findReadFunction(name: string): Readonly<{ name: string; inputs: readonly Readonly<{ type: string }>[] }> {
  const entries = settlementEscrowAbi.filter(isAbiFunction).filter((entry) => entry.name === name);
  if (entries.length !== 1) throw new TypeError(`Generated SettlementEscrow ABI must expose exactly one ${name} function`);
  const entry = entries[0]!;
  if (entry.stateMutability !== "view") {
    throw new TypeError(`SettlementEscrow integrity checker refuses non-read function ${name}`);
  }
  return entry;
}

function isAbiFunction(entry: (typeof settlementEscrowAbi)[number]): entry is Extract<(typeof settlementEscrowAbi)[number], { type: "function" }> {
  return entry.type === "function";
}

function encodeWord(value: string): string {
  if (WORD.test(value)) return value.slice(2).toLowerCase();
  const address = normalizeAddress(nonZeroEvmAddressSchema.parse(value));
  return address.slice(2).padStart(64, "0");
}

async function call(fetcher: typeof globalThis.fetch, url: string, to: EvmAddress, data: string): Promise<unknown> {
  return rpc(fetcher, url, "eth_call", [{ to, data }, "latest"]);
}

async function rpc(fetcher: typeof globalThis.fetch, url: string, method: "eth_chainId" | "eth_getCode" | "eth_call", params: readonly unknown[]): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
  } catch {
    throw new TypeError(`Arc Testnet RPC ${method} request failed`);
  }
  if (!response.ok) throw new TypeError(`Arc Testnet RPC ${method} failed with HTTP ${response.status}`);
  let body: Readonly<{ result?: unknown; error?: unknown }>;
  try {
    body = await response.json() as Readonly<{ result?: unknown; error?: unknown }>;
  } catch {
    throw new TypeError(`Arc Testnet RPC ${method} returned invalid JSON`);
  }
  if (body.error !== undefined) throw new TypeError(`Arc Testnet RPC ${method} returned an error`);
  if (!("result" in body)) throw new TypeError(`Arc Testnet RPC ${method} returned no result`);
  return body.result;
}

function decodeWord(value: unknown): string {
  if (typeof value !== "string" || !WORD.test(value)) throw new TypeError("Arc Testnet eth_call returned invalid 32-byte data");
  return value.toLowerCase();
}

function decodeAddress(value: unknown): EvmAddress {
  const word = decodeWord(value);
  if (!/^0x0{24}[0-9a-f]{40}$/.test(word)) throw new TypeError("Arc Testnet eth_call returned invalid address data");
  return normalizeAddress(nonZeroEvmAddressSchema.parse(`0x${word.slice(-40)}`));
}

function decodeUint(value: unknown): bigint {
  return BigInt(decodeWord(value));
}

function decodeBool(value: unknown): boolean {
  const number = decodeUint(value);
  if (number !== 0n && number !== 1n) throw new TypeError("Arc Testnet eth_call returned invalid boolean data");
  return number === 1n;
}

function readNonEmptyHex(value: unknown, message: string): string {
  if (typeof value !== "string" || !HEX_DATA.test(value) || value === "0x" || /^0x0*$/.test(value)) throw new TypeError(message);
  return value.toLowerCase();
}

function compareRuntimeBytecode(onchain: string, artifact: RuntimeArtifact, immutableAddress: EvmAddress): void {
  if (Object.keys(artifact.linkReferences).length !== 0) {
    throw new TypeError("SettlementEscrow runtime artifact contains unresolved library link references");
  }
  const local = readNonEmptyHex(artifact.object, "SettlementEscrow artifact has empty deployed runtime bytecode");
  let expected = local.slice(2);
  const replacement = encodeWord(immutableAddress);
  for (const references of Object.values(artifact.immutableReferences)) {
    for (const reference of references) {
      if (!Number.isSafeInteger(reference.start) || reference.start < 0 || reference.length !== 32) {
        throw new TypeError("SettlementEscrow runtime artifact has unsupported immutable references");
      }
      const start = reference.start * 2;
      if (start + 64 > expected.length) throw new TypeError("SettlementEscrow runtime artifact has out-of-range immutable references");
      expected = `${expected.slice(0, start)}${replacement}${expected.slice(start + 64)}`;
    }
  }
  if (`0x${expected}` !== onchain) {
    throw new TypeError("Onchain SettlementEscrow runtime bytecode does not match the local artifact after immutable substitution");
  }
}

async function readRuntimeArtifact(path: string): Promise<RuntimeArtifact> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch {
    throw new TypeError(`SettlementEscrow Foundry artifact is missing at ${SETTLEMENT_ESCROW_ARTIFACT_PATH}. Run pnpm contracts:build first.`);
  }
  let artifact: unknown;
  try {
    artifact = JSON.parse(source);
  } catch {
    throw new TypeError("SettlementEscrow Foundry artifact is not valid JSON");
  }
  const deployed = isRecord(artifact) ? artifact.deployedBytecode : undefined;
  if (!isRecord(deployed) || typeof deployed.object !== "string" || !isRecord(deployed.immutableReferences) || !isRecord(deployed.linkReferences)) {
    throw new TypeError("SettlementEscrow Foundry artifact does not contain usable deployed runtime bytecode metadata");
  }
  return deployed as unknown as RuntimeArtifact;
}

function readRequiredAddress(environment: Readonly<Record<string, string | undefined>>, name: string): EvmAddress {
  const value = readNonEmptyEnvironmentValue(environment, name);
  if (value === undefined) throw new TypeError(`Missing required integrity-check field: ${name}`);
  return normalizeAddress(nonZeroEvmAddressSchema.parse(value));
}

function formatChainId(value: unknown): string {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return "invalid RPC value";
  return BigInt(value).toString();
}

function bytesToHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}