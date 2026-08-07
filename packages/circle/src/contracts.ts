import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ARC_TESTNET, settlementEscrowAbi } from "@settle/shared";
import type { EvmAddress } from "@settle/shared";
import type { CircleDeploymentConfig } from "./config.ts";

export const SETTLEMENT_ESCROW_CONTRACT_NAME = "SettlementEscrow" as const;
export const SETTLEMENT_ESCROW_CONTRACT_DESCRIPTION = "SettleUSDCSettlementArcTestnet" as const;
export const SETTLEMENT_ESCROW_ARTIFACT_PATH = "packages/contracts/out/SettlementEscrow.sol/SettlementEscrow.json" as const;
const DEFAULT_SETTLEMENT_ESCROW_ARTIFACT_PATH = fileURLToPath(
  new URL("../../contracts/out/SettlementEscrow.sol/SettlementEscrow.json", import.meta.url),
);

export interface CircleContractDeploymentPreparation {
  readonly contractName: typeof SETTLEMENT_ESCROW_CONTRACT_NAME;
  readonly description: string;
  readonly blockchain: "ARC-TESTNET";
  readonly deployerWalletId: string;
  readonly deployerAddress: EvmAddress;
  readonly abi: readonly unknown[];
  readonly bytecode: string;
  readonly constructorSignature: string;
  readonly constructorParameters: readonly [EvmAddress, EvmAddress, EvmAddress, EvmAddress, EvmAddress];
}

export interface CanonicalCircleDeploymentRequest {
  readonly name: typeof SETTLEMENT_ESCROW_CONTRACT_NAME;
  readonly description: string;
  readonly blockchain: "ARC-TESTNET";
  readonly walletId: string;
  readonly abiJson: string;
  readonly bytecode: string;
  readonly constructorParameters: readonly [EvmAddress, EvmAddress, EvmAddress, EvmAddress, EvmAddress];
  readonly fee: Readonly<{ type: "level"; config: Readonly<{ feeLevel: "MEDIUM" }> }>;
}

export interface PublicationSafeDeploymentSummary {
  readonly contractName: typeof SETTLEMENT_ESCROW_CONTRACT_NAME;
  readonly blockchain: "ARC-TESTNET";
  readonly deployerWalletId: string;
  readonly deployerAddress: EvmAddress;
  readonly bytecodeLength: number;
  readonly abiEntryCount: number;
  readonly officialUsdcAddress: EvmAddress;
  readonly constructorRoles: Readonly<{
    administratorAddress: EvmAddress;
    operatorAddress: EvmAddress;
    arbitratorAddress: EvmAddress;
    pauserAddress: EvmAddress;
  }>;
}

interface FoundryArtifact {
  readonly abi?: unknown;
  readonly bytecode?: unknown;
}

export async function prepareSettlementEscrowDeployment(
  config: CircleDeploymentConfig,
  artifactPath: string = DEFAULT_SETTLEMENT_ESCROW_ARTIFACT_PATH,
  description: string = SETTLEMENT_ESCROW_CONTRACT_DESCRIPTION,
): Promise<CircleContractDeploymentPreparation> {
  assertAlphanumericDescription(description);
  const artifact = await readFoundryArtifact(artifactPath);
  if (!Array.isArray(artifact.abi) || artifact.abi.length === 0) {
    throw new TypeError("SettlementEscrow artifact must contain a non-empty ABI array");
  }
  const bytecode = readBytecode(artifact.bytecode);
  assertGeneratedAbiCurrent(artifact.abi);
  const constructorSignature = deriveConstructorSignature(artifact.abi);
  const officialUsdcAddress = ARC_TESTNET.usdc.address;

  return {
    contractName: SETTLEMENT_ESCROW_CONTRACT_NAME,
    description,
    blockchain: "ARC-TESTNET",
    deployerWalletId: config.deployerWalletId,
    deployerAddress: config.deployerAddress,
    abi: artifact.abi,
    bytecode,
    constructorSignature,
    constructorParameters: [
      officialUsdcAddress,
      config.administratorAddress,
      config.operatorAddress,
      config.arbitratorAddress,
      config.pauserAddress,
    ],
  };
}

export function createCanonicalDeploymentRequest(preparation: CircleContractDeploymentPreparation): CanonicalCircleDeploymentRequest {
  return {
    name: preparation.contractName,
    description: preparation.description,
    blockchain: preparation.blockchain,
    walletId: preparation.deployerWalletId,
    abiJson: JSON.stringify(preparation.abi),
    bytecode: preparation.bytecode,
    constructorParameters: preparation.constructorParameters,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  };
}

function assertAlphanumericDescription(description: string): void {
  if (!/^[A-Za-z0-9]+$/.test(description)) {
    throw new TypeError("Circle contract description must contain only ASCII letters and digits");
  }
}

export function deriveConstructorSignature(abi: readonly unknown[]): string {
  const constructors = abi.filter(isRecord).filter((entry) => entry.type === "constructor");
  if (constructors.length !== 1) throw new TypeError("SettlementEscrow ABI must contain exactly one constructor");
  const inputs = constructors[0]?.["inputs"];
  if (!Array.isArray(inputs) || inputs.length !== 5) throw new TypeError("SettlementEscrow constructor must contain exactly five inputs");
  const types = inputs.map((input) => isRecord(input) && typeof input.type === "string" ? input.type : undefined);
  if (types.some((type) => type !== "address")) throw new TypeError("SettlementEscrow constructor inputs must be five addresses");
  return `constructor(${types.join(",")})`;
}

export function createPublicationSafeDeploymentSummary(
  preparation: CircleContractDeploymentPreparation,
): PublicationSafeDeploymentSummary {
  const [, administratorAddress, operatorAddress, arbitratorAddress, pauserAddress] = preparation.constructorParameters;
  return {
    contractName: preparation.contractName,
    blockchain: preparation.blockchain,
    deployerWalletId: preparation.deployerWalletId,
    deployerAddress: preparation.deployerAddress,
    bytecodeLength: (preparation.bytecode.length - 2) / 2,
    abiEntryCount: preparation.abi.length,
    officialUsdcAddress: preparation.constructorParameters[0],
    constructorRoles: { administratorAddress, operatorAddress, arbitratorAddress, pauserAddress },
  };
}

async function readFoundryArtifact(path: string): Promise<FoundryArtifact> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      const displayPath = path === DEFAULT_SETTLEMENT_ESCROW_ARTIFACT_PATH ? SETTLEMENT_ESCROW_ARTIFACT_PATH : path;
      throw new TypeError(`SettlementEscrow Foundry artifact is missing at ${displayPath}. Run pnpm contracts:build first.`);
    }
    throw error;
  }
  try {
    return JSON.parse(source) as FoundryArtifact;
  } catch {
    throw new TypeError("SettlementEscrow Foundry artifact is not valid JSON");
  }
}

function readBytecode(value: unknown): string {
  const bytecode = typeof value === "string"
    ? value
    : value !== null && typeof value === "object" && typeof (value as Record<string, unknown>).object === "string"
      ? (value as Record<string, string>).object
      : undefined;
  if (bytecode === undefined || !/^0x[0-9a-fA-F]*$/.test(bytecode) || bytecode === "0x" || /^0x0*$/.test(bytecode)) {
    throw new TypeError("SettlementEscrow deployment bytecode must be non-empty hexadecimal bytecode");
  }
  return bytecode;
}

function assertGeneratedAbiCurrent(artifactAbi: readonly unknown[]): void {
  if (JSON.stringify(artifactAbi) !== JSON.stringify(settlementEscrowAbi)) {
    throw new TypeError("Generated shared SettlementEscrow ABI is stale. Run pnpm contracts:abi first.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}