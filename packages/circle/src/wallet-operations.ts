import { getExplorerAddressUrl, getExplorerTransactionUrl, nonZeroEvmAddressSchema, normalizeAddress, transactionHashSchema } from "@settle/shared";
import type { EvmAddress } from "@settle/shared";
import type { CircleDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { withCircleErrorNormalization } from "./errors.ts";
import { CIRCLE_ARC_TESTNET_BLOCKCHAIN, preflightDeployerWallet } from "./wallets.ts";
import type { CircleWalletRecord } from "./wallets.ts";

export const ARC_TESTNET_USDC_TOKEN_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
export const DEFAULT_TRANSACTION_PAGE_SIZE = 10;
export const MAX_TRANSACTION_PAGE_SIZE = 50;

export interface CircleWalletBalanceRecord {
  readonly amount: string;
  readonly updateDate?: string;
  readonly token: Readonly<{
    readonly id?: string;
    readonly name?: string;
    readonly symbol?: string;
    readonly blockchain: string;
    readonly decimals?: number;
    readonly standard?: string;
    readonly isNative: boolean;
    readonly tokenAddress?: string;
  }>;
}

export interface CircleWalletTransactionRecord {
  readonly id?: string;
  readonly walletId?: string;
  readonly blockchain: string;
  readonly transactionType: string;
  readonly operation?: string;
  readonly state: string;
  readonly createDate: string;
  readonly updateDate: string;
  readonly amounts?: readonly string[];
  readonly sourceAddress?: string;
  readonly destinationAddress?: string;
  readonly contractAddress?: string;
  readonly txHash?: string;
  readonly blockHeight?: number;
  readonly tokenId?: string;
}

export interface CircleWalletReadOnlyGateway {
  getWallet(walletId: string): Promise<CircleWalletRecord>;
  getWalletBalances(input: Readonly<{ walletId: string; tokenAddress?: EvmAddress }>): Promise<readonly CircleWalletBalanceRecord[]>;
  listWalletTransactions(input: Readonly<{ walletId: string; pageSize: number }>): Promise<readonly CircleWalletTransactionRecord[]>;
}

export interface SafeWalletInfo {
  readonly address: EvmAddress;
  readonly blockchain: typeof CIRCLE_ARC_TESTNET_BLOCKCHAIN;
  readonly accountType: "EOA";
  readonly custodyType?: string;
  readonly state?: string;
  readonly arcScanUrl: string;
}

export interface SafeWalletBalance {
  readonly symbol?: string;
  readonly name?: string;
  readonly amount: string;
  readonly decimals?: number;
  readonly standard?: string;
  readonly tokenAddress?: EvmAddress;
  readonly classification: "native" | "token";
  readonly arcUsdcView?: "native view" | "canonical ERC-20 view";
}

export interface SafeWalletTransaction {
  readonly transactionType: string;
  readonly operation?: string;
  readonly state: string;
  readonly createDate: string;
  readonly updateDate: string;
  readonly amounts?: readonly string[];
  readonly sourceAddress?: string;
  readonly destinationAddress?: string;
  readonly contractAddress?: string;
  readonly transactionHash?: string;
  readonly blockHeight?: number;
  readonly arcScanUrl?: string;
}

export async function getConfiguredWalletInfo(input: Readonly<{
  gateway: CircleWalletReadOnlyGateway;
  configuredWalletId: string;
  configuredAddress: EvmAddress;
}>): Promise<SafeWalletInfo> {
  const wallet = await preflightDeployerWallet(input);
  return {
    address: wallet.address,
    blockchain: wallet.blockchain,
    accountType: wallet.accountType,
    ...(wallet.custodyType === undefined ? {} : { custodyType: wallet.custodyType }),
    ...(wallet.state === undefined ? {} : { state: wallet.state }),
    arcScanUrl: getExplorerAddressUrl(wallet.address),
  };
}

export async function getConfiguredWalletBalances(input: Readonly<{
  gateway: CircleWalletReadOnlyGateway;
  configuredWalletId: string;
  configuredAddress: EvmAddress;
  tokenAddress?: string;
}>): Promise<readonly SafeWalletBalance[]> {
  await preflightDeployerWallet(input);
  const tokenAddress = input.tokenAddress === undefined ? undefined : normalizeAddress(nonZeroEvmAddressSchema.parse(input.tokenAddress));
  const balances = await input.gateway.getWalletBalances({
    walletId: input.configuredWalletId,
    ...(tokenAddress === undefined ? {} : { tokenAddress }),
  });
  return balances.map(toSafeBalance);
}

export async function getConfiguredWalletTransactions(input: Readonly<{
  gateway: CircleWalletReadOnlyGateway;
  configuredWalletId: string;
  configuredAddress: EvmAddress;
  pageSize?: number;
}>): Promise<readonly SafeWalletTransaction[]> {
  await preflightDeployerWallet(input);
  const pageSize = parseTransactionPageSize(input.pageSize ?? DEFAULT_TRANSACTION_PAGE_SIZE);
  const transactions = await input.gateway.listWalletTransactions({ walletId: input.configuredWalletId, pageSize });
  return transactions.map((transaction) => {
    if (transaction.walletId !== undefined && transaction.walletId !== input.configuredWalletId) {
      throw new TypeError("Circle transaction history contained a record for another wallet");
    }
    if (transaction.blockchain !== CIRCLE_ARC_TESTNET_BLOCKCHAIN) {
      throw new TypeError(`Circle transaction history contained non-${CIRCLE_ARC_TESTNET_BLOCKCHAIN} data`);
    }
    const transactionHash = transaction.txHash === undefined ? undefined : transactionHashSchema.parse(transaction.txHash);
    return {
      transactionType: transaction.transactionType,
      ...(transaction.operation === undefined ? {} : { operation: transaction.operation }),
      state: transaction.state,
      createDate: transaction.createDate,
      updateDate: transaction.updateDate,
      ...(transaction.amounts === undefined ? {} : { amounts: transaction.amounts }),
      ...(transaction.sourceAddress === undefined ? {} : { sourceAddress: transaction.sourceAddress }),
      ...(transaction.destinationAddress === undefined ? {} : { destinationAddress: transaction.destinationAddress }),
      ...(transaction.contractAddress === undefined ? {} : { contractAddress: transaction.contractAddress }),
      ...(transactionHash === undefined ? {} : { transactionHash, arcScanUrl: getExplorerTransactionUrl(transactionHash) }),
      ...(transaction.blockHeight === undefined ? {} : { blockHeight: transaction.blockHeight }),
    };
  });
}

export function parseTransactionPageSize(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_TRANSACTION_PAGE_SIZE) {
    throw new TypeError(`--page-size must be an integer from 1 to ${MAX_TRANSACTION_PAGE_SIZE}`);
  }
  return value;
}

export function parseSingleValueOption(args: readonly string[], option: "--token-address" | "--page-size"): string | undefined {
  if (args.length === 0) return undefined;
  if (args.length !== 2 || args[0] !== option || args[1] === undefined || args[1].startsWith("--")) {
    throw new TypeError(`Expected either no arguments or ${option} <value>`);
  }
  return args[1];
}

export function formatWalletInfo(info: SafeWalletInfo): readonly string[] {
  return [
    `blockchain: ${info.blockchain}`,
    `wallet address: ${info.address}`,
    `account type: ${info.accountType}`,
    ...(info.custodyType === undefined ? [] : [`custody type: ${info.custodyType}`]),
    ...(info.state === undefined ? [] : [`wallet state: ${info.state}`]),
    `ArcScan address URL: ${info.arcScanUrl}`,
  ];
}

export function formatWalletBalances(balances: readonly SafeWalletBalance[]): readonly string[] {
  if (balances.length === 0) return ["No Circle-indexed token balances were returned for the configured wallet."];
  const lines = balances.flatMap((balance, index) => [
    `balance ${index + 1}:`,
    `  symbol: ${balance.symbol ?? "unavailable"}`,
    `  name: ${balance.name ?? "unavailable"}`,
    `  amount: ${balance.amount}`,
    `  decimals: ${balance.decimals ?? "unavailable"}`,
    `  standard: ${balance.standard ?? "unavailable"}`,
    `  classification: ${balance.classification}`,
    ...(balance.tokenAddress === undefined ? [] : [`  token address: ${balance.tokenAddress}`]),
    ...(balance.arcUsdcView === undefined ? [] : [`  Arc USDC representation: ${balance.arcUsdcView}`]),
  ]);
  if (balances.some((balance) => balance.arcUsdcView === "native view") && balances.some((balance) => balance.arcUsdcView === "canonical ERC-20 view")) {
    lines.push("Arc USDC note: native and canonical ERC-20 entries are alternate views of the same underlying value and are not summed.");
  }
  return lines;
}

export function formatWalletTransactions(transactions: readonly SafeWalletTransaction[]): readonly string[] {
  if (transactions.length === 0) return ["No Circle wallet transaction records were returned."];
  return transactions.flatMap((transaction, index) => [
    `transaction ${index + 1}:`,
    `  type: ${transaction.transactionType}`,
    ...(transaction.operation === undefined ? [] : [`  operation: ${transaction.operation}`]),
    `  state: ${transaction.state}`,
    `  created: ${transaction.createDate}`,
    `  updated: ${transaction.updateDate}`,
    ...(transaction.amounts === undefined ? [] : [`  amounts: ${transaction.amounts.join(", ")}`]),
    ...(transaction.sourceAddress === undefined ? [] : [`  source: ${transaction.sourceAddress}`]),
    ...(transaction.destinationAddress === undefined ? [] : [`  destination: ${transaction.destinationAddress}`]),
    ...(transaction.contractAddress === undefined ? [] : [`  contract: ${transaction.contractAddress}`]),
    ...(transaction.transactionHash === undefined ? [] : [`  transaction hash: ${transaction.transactionHash}`]),
    ...(transaction.blockHeight === undefined ? [] : [`  block height: ${transaction.blockHeight}`]),
    ...(transaction.arcScanUrl === undefined ? [] : [`  ArcScan transaction URL: ${transaction.arcScanUrl}`]),
  ]);
}

export function createCircleWalletReadOnlyGateway(client: CircleDeveloperControlledWalletsClient): CircleWalletReadOnlyGateway {
  return {
    async getWallet(walletId) {
      return withCircleErrorNormalization("getWallet", async () => {
        const wallet = (await client.getWallet({ id: walletId })).data?.wallet;
        if (wallet === undefined) throw new TypeError("Circle getWallet response did not contain a wallet");
        return {
          id: wallet.id,
          walletSetId: wallet.walletSetId,
          address: wallet.address,
          blockchain: wallet.blockchain,
          accountType: wallet.accountType,
          custodyType: wallet.custodyType,
          state: wallet.state,
        };
      });
    },
    async getWalletBalances(input) {
      return withCircleErrorNormalization("getWalletTokenBalance", async () => {
        const response = await client.getWalletTokenBalance({
          id: input.walletId,
          includeAll: true,
          ...(input.tokenAddress === undefined ? {} : { tokenAddresses: [input.tokenAddress] }),
        });
        return (response.data?.tokenBalances ?? []).map((balance) => ({
          amount: balance.amount,
          updateDate: balance.updateDate,
          token: {
            id: balance.token.id,
            name: balance.token.name,
            symbol: balance.token.symbol,
            blockchain: balance.token.blockchain,
            decimals: balance.token.decimals,
            standard: balance.token.standard,
            isNative: balance.token.isNative,
            tokenAddress: balance.token.tokenAddress,
          },
        }));
      });
    },
    async listWalletTransactions(input) {
      return withCircleErrorNormalization("listTransactions", async () => {
        const response = await client.listTransactions({
          walletIds: [input.walletId],
          pageSize: input.pageSize,
          includeAll: true,
        });
        return (response.data?.transactions ?? []).map((transaction) => ({
          id: transaction.id,
          walletId: transaction.walletId,
          blockchain: transaction.blockchain,
          transactionType: transaction.transactionType,
          operation: transaction.operation,
          state: transaction.state,
          createDate: transaction.createDate,
          updateDate: transaction.updateDate,
          amounts: transaction.amounts,
          sourceAddress: transaction.sourceAddress,
          destinationAddress: transaction.destinationAddress,
          contractAddress: transaction.contractAddress,
          txHash: transaction.txHash,
          blockHeight: transaction.blockHeight,
          tokenId: transaction.tokenId,
        }));
      });
    },
  };
}

function toSafeBalance(balance: CircleWalletBalanceRecord): SafeWalletBalance {
  if (balance.token.blockchain !== CIRCLE_ARC_TESTNET_BLOCKCHAIN) {
    throw new TypeError(`Circle balance response contained non-${CIRCLE_ARC_TESTNET_BLOCKCHAIN} token data`);
  }
  const tokenAddress = balance.token.tokenAddress === undefined ? undefined : normalizeAddress(nonZeroEvmAddressSchema.parse(balance.token.tokenAddress));
  const isCanonicalUsdc = tokenAddress === ARC_TESTNET_USDC_TOKEN_ADDRESS;
  const isArcUsdc = balance.token.symbol?.toUpperCase() === "USDC";
  return {
    ...(balance.token.symbol === undefined ? {} : { symbol: balance.token.symbol }),
    ...(balance.token.name === undefined ? {} : { name: balance.token.name }),
    amount: balance.amount,
    ...(balance.token.decimals === undefined ? {} : { decimals: balance.token.decimals }),
    ...(balance.token.standard === undefined ? {} : { standard: balance.token.standard }),
    ...(tokenAddress === undefined ? {} : { tokenAddress }),
    classification: balance.token.isNative ? "native" : "token",
    ...(isCanonicalUsdc ? { arcUsdcView: "canonical ERC-20 view" as const } : balance.token.isNative && isArcUsdc ? { arcUsdcView: "native view" as const } : {}),
  };
}