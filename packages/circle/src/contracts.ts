import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ARC_TESTNET } from "@settle/shared";
import type { EvmAddress } from "@settle/shared";
import type { CircleDeploymentConfig } from "./config.ts";

export const SETTLEMENT_ESCROW_CONTRACT_NAME = "SettlementEscrow" as const;
export const SETTLEMENT_ESCROW_ARTIFACT_PATH = "packages/contracts/out/SettlementEscrow.sol/SettlementEscrow.json" as const;
const DEFAULT_SETTLEMENT_ESCROW_ARTIFACT_PATH = fileURLToPath(
  new URL("../../contracts/out/SettlementEscrow.sol/SettlementEscrow.json", import.meta.url),
);

export interface CircleContractDeploymentPreparation {
  readonly contractName: typeof SETTLEMENT_ESCROW_CONTRACT_NAME;
  readonly blockchain: "ARC-TESTNET";
  readonly deployerWalletId: string;
  readonly deployerAddress: EvmAddress;
  readonly abi: readonly unknown[];
  readonly bytecode: string;
  readonly constructorParameters: readonly [EvmAddress, EvmAddress, EvmAddress, EvmAddress, EvmAddress];
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
): Promise<CircleContractDeploymentPreparation> {
  const artifact = await readFoundryArtifact(artifactPath);
  if (!Array.isArray(artifact.abi) || artifact.abi.length === 0) {
    throw new TypeError("SettlementEscrow artifact must contain a non-empty ABI array");
  }
  const bytecode = readBytecode(artifact.bytecode);
  const officialUsdcAddress = ARC_TESTNET.usdc.address;

  return {
    contractName: SETTLEMENT_ESCROW_CONTRACT_NAME,
    blockchain: "ARC-TESTNET",
    deployerWalletId: config.deployerWalletId,
    deployerAddress: config.deployerAddress,
    abi: artifact.abi,
    bytecode,
    constructorParameters: [
      officialUsdcAddress,
      config.administratorAddress,
      config.operatorAddress,
      config.arbitratorAddress,
      config.pauserAddress,
    ],
  };
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}