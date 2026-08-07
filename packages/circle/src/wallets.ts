import { nonZeroEvmAddressSchema, normalizeAddress } from "@settle/shared";
import type { EvmAddress } from "@settle/shared";
import type { CircleDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { withCircleErrorNormalization } from "./errors.ts";

export const CIRCLE_ARC_TESTNET_BLOCKCHAIN = "ARC-TESTNET" as const;
export const CIRCLE_DEPLOYER_ACCOUNT_TYPE = "EOA" as const;

export interface PublicationSafeWalletMetadata {
  readonly walletSetId: string;
  readonly walletId: string;
  readonly address: EvmAddress;
  readonly blockchain: typeof CIRCLE_ARC_TESTNET_BLOCKCHAIN;
  readonly accountType: typeof CIRCLE_DEPLOYER_ACCOUNT_TYPE;
  readonly custodyType?: string;
  readonly state?: string;
}

export interface CircleWalletRecord {
  readonly id: string;
  readonly walletSetId: string;
  readonly address: string;
  readonly blockchain: string;
  readonly accountType?: string;
  readonly custodyType?: string;
  readonly state?: string;
}

export async function preflightDeployerWallet(input: Readonly<{
  gateway: CircleWalletGateway;
  configuredWalletId: string;
  configuredAddress: EvmAddress;
}>): Promise<PublicationSafeWalletMetadata> {
  const wallet = await input.gateway.getWallet(input.configuredWalletId);
  if (wallet.id !== input.configuredWalletId) throw new TypeError("Circle wallet ID does not match configured deployer wallet ID");
  const metadata = validateArcTestnetWallet(wallet);
  if (metadata.address !== normalizeAddress(input.configuredAddress)) throw new TypeError("Circle wallet address does not match configured deployer address");
  if (wallet.custodyType !== undefined && wallet.custodyType !== "DEVELOPER") throw new TypeError("Expected developer-controlled wallet custody type");
  if (wallet.state !== undefined && wallet.state !== "LIVE") throw new TypeError("Expected Circle deployer wallet state LIVE");
  return metadata;
}

export interface CircleWalletGateway {
  createWalletSet(input: Readonly<{ name: string; idempotencyKey: string }>): Promise<Readonly<{ id: string }>>;
  createWallet(input: Readonly<{ walletSetId: string; idempotencyKey: string }>): Promise<CircleWalletRecord>;
  getWallet(walletId: string): Promise<CircleWalletRecord>;
  listWallets(walletSetId?: string): Promise<readonly CircleWalletRecord[]>;
}

export interface DeployerWalletPlan {
  readonly mode: "dry-run" | "execute";
  readonly walletSet: Readonly<{ action: "reuse"; id: string } | { action: "create" }>;
  readonly wallet: Readonly<{ action: "reuse"; id: string } | { action: "create" }>;
  readonly blockchain: typeof CIRCLE_ARC_TESTNET_BLOCKCHAIN;
  readonly accountType: typeof CIRCLE_DEPLOYER_ACCOUNT_TYPE;
}

export interface ExecuteDeployerWalletInput {
  readonly gateway: CircleWalletGateway;
  readonly configuredWalletSetId?: string;
  readonly configuredWalletId?: string;
  readonly walletSetIdempotencyKey?: string;
  readonly walletIdempotencyKey?: string;
  readonly walletSetName?: string;
}

export function planDeployerWallet(input: Readonly<{
  execute: boolean;
  configuredWalletSetId?: string;
  configuredWalletId?: string;
}>): DeployerWalletPlan {
  return {
    mode: input.execute ? "execute" : "dry-run",
    walletSet: input.configuredWalletSetId === undefined
      ? { action: "create" }
      : { action: "reuse", id: input.configuredWalletSetId },
    wallet: input.configuredWalletId === undefined
      ? { action: "create" }
      : { action: "reuse", id: input.configuredWalletId },
    blockchain: CIRCLE_ARC_TESTNET_BLOCKCHAIN,
    accountType: CIRCLE_DEPLOYER_ACCOUNT_TYPE,
  };
}

export async function executeDeployerWalletPlan(input: ExecuteDeployerWalletInput): Promise<PublicationSafeWalletMetadata> {
  if (input.configuredWalletId !== undefined) {
    return validateArcTestnetWallet(await input.gateway.getWallet(input.configuredWalletId));
  }

  const walletSetId = input.configuredWalletSetId ?? await createWalletSet(input);
  if (input.walletIdempotencyKey === undefined) {
    throw new TypeError("--wallet-idempotency-key is required when creating a deployer wallet");
  }

  return validateArcTestnetWallet(await input.gateway.createWallet({
    walletSetId,
    idempotencyKey: input.walletIdempotencyKey,
  }));
}

export function validateArcTestnetWallet(wallet: CircleWalletRecord): PublicationSafeWalletMetadata {
  if (wallet.blockchain !== CIRCLE_ARC_TESTNET_BLOCKCHAIN) {
    throw new TypeError(`Expected wallet blockchain ${CIRCLE_ARC_TESTNET_BLOCKCHAIN}`);
  }
  if (wallet.accountType !== CIRCLE_DEPLOYER_ACCOUNT_TYPE) {
    throw new TypeError(`Expected wallet account type ${CIRCLE_DEPLOYER_ACCOUNT_TYPE}`);
  }
  const address = nonZeroEvmAddressSchema.parse(wallet.address);
  return {
    walletSetId: wallet.walletSetId,
    walletId: wallet.id,
    address: normalizeAddress(address),
    blockchain: CIRCLE_ARC_TESTNET_BLOCKCHAIN,
    accountType: CIRCLE_DEPLOYER_ACCOUNT_TYPE,
    ...(wallet.custodyType === undefined ? {} : { custodyType: wallet.custodyType }),
    ...(wallet.state === undefined ? {} : { state: wallet.state }),
  };
}

export function createCircleWalletGateway(client: CircleDeveloperControlledWalletsClient): CircleWalletGateway {
  return {
    async createWalletSet(input) {
      return withCircleErrorNormalization("createWalletSet", async () => {
        const response = await client.createWalletSet(input);
        const id = response.data?.walletSet.id;
        if (id === undefined) throw new TypeError("Circle createWalletSet response did not contain a wallet set ID");
        return { id };
      });
    },
    async createWallet(input) {
      return withCircleErrorNormalization("createArcTestnetDeployerWallet", async () => {
        const response = await client.createWallets({
          walletSetId: input.walletSetId,
          idempotencyKey: input.idempotencyKey,
          blockchains: [CIRCLE_ARC_TESTNET_BLOCKCHAIN],
          accountType: CIRCLE_DEPLOYER_ACCOUNT_TYPE,
          count: 1,
        });
        const wallet = response.data?.wallets[0];
        if (wallet === undefined) throw new TypeError("Circle createWallets response did not contain a wallet");
        return toWalletRecord(wallet);
      });
    },
    async getWallet(walletId) {
      return withCircleErrorNormalization("getWallet", async () => {
        const response = await client.getWallet({ id: walletId });
        const wallet = response.data?.wallet;
        if (wallet === undefined) throw new TypeError("Circle getWallet response did not contain a wallet");
        return toWalletRecord(wallet);
      });
    },
    async listWallets(walletSetId) {
      return withCircleErrorNormalization("listWallets", async () => {
        const response = await client.listWallets(walletSetId === undefined ? undefined : { walletSetId });
        return (response.data?.wallets ?? []).map(toWalletRecord);
      });
    },
  };
}

async function createWalletSet(input: ExecuteDeployerWalletInput): Promise<string> {
  if (input.walletSetIdempotencyKey === undefined) {
    throw new TypeError("--wallet-set-idempotency-key is required when creating a wallet set");
  }
  const walletSet = await input.gateway.createWalletSet({
    name: input.walletSetName ?? "Settle Arc Testnet Deployment",
    idempotencyKey: input.walletSetIdempotencyKey,
  });
  return walletSet.id;
}

function toWalletRecord(wallet: Readonly<{
  id: string;
  walletSetId: string;
  address: string;
  blockchain: string;
  accountType?: string;
  custodyType?: string;
  state?: string;
}>): CircleWalletRecord {
  return {
    id: wallet.id,
    walletSetId: wallet.walletSetId,
    address: wallet.address,
    blockchain: wallet.blockchain,
    accountType: wallet.accountType,
    custodyType: wallet.custodyType,
    state: wallet.state,
  };
}