import { getExplorerTransactionUrl, transactionHashSchema } from "@settle/shared";
import type { CircleDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { z } from "zod";
import { withCircleErrorNormalization } from "./errors.ts";
import { redactString } from "./redaction.ts";
import { CIRCLE_ARC_TESTNET_BLOCKCHAIN } from "./wallets.ts";

export const WALLET_TRANSACTION_SUCCESS_STATE = "COMPLETE" as const;
export const WALLET_TRANSACTION_FAILURE_STATES = new Set(["STUCK", "FAILED", "DENIED", "CANCELLED"] as const);
export type WalletTransactionFailureState = "STUCK" | "FAILED" | "DENIED" | "CANCELLED";

const uuidSchema = z.string().uuid();

export interface WalletTransactionStatusArguments {
  readonly transactionId: string;
  readonly wait: boolean;
  readonly intervalSeconds: number;
  readonly timeoutSeconds: number;
}

export interface SafeWalletTransactionStatus {
  readonly transactionId: string;
  readonly blockchain: string;
  readonly state: string;
  readonly transactionType: string;
  readonly operation?: string;
  readonly createDate: string;
  readonly updateDate: string;
  readonly transactionHash?: string;
  readonly blockHeight?: number;
  readonly networkFee?: string;
  readonly failureReason?: string;
  readonly sourceAddress?: string;
  readonly destinationAddress?: string;
  readonly contractAddress?: string;
  readonly arcScanUrl?: string;
}

export interface WalletTransactionStatusGateway {
  getTransaction(transactionId: string): Promise<CircleWalletTransactionStatusRecord>;
}

type GetTransactionResponse = Awaited<ReturnType<CircleDeveloperControlledWalletsClient["getTransaction"]>>;
export type CircleWalletTransactionStatusRecord = NonNullable<NonNullable<GetTransactionResponse["data"]>["transaction"]>;

export function parseWalletTransactionStatusArguments(values: readonly string[]): WalletTransactionStatusArguments {
  let transactionId: string | undefined;
  let wait = false;
  let intervalSeconds = 5;
  let timeoutSeconds = 600;
  let intervalProvided = false;
  let timeoutProvided = false;
  for (let index = 0; index < values.length; index += 1) {
    const argument = values[index];
    if (argument === "--transaction-id") {
      if (transactionId !== undefined) throw new TypeError("--transaction-id may only be provided once");
      const value = values[++index];
      if (value === undefined || value.startsWith("--")) throw new TypeError("--transaction-id requires a value");
      transactionId = uuidSchema.parse(value);
    } else if (argument === "--wait") {
      if (wait) throw new TypeError("--wait may only be provided once");
      wait = true;
    } else if (argument === "--interval-seconds" || argument === "--timeout-seconds") {
      const value = values[++index];
      if (value === undefined || value.startsWith("--")) throw new TypeError(`${argument} requires an integer value`);
      const number = readWaitNumber(value, argument);
      if (argument === "--interval-seconds") {
        if (intervalProvided) throw new TypeError("--interval-seconds may only be provided once");
        intervalProvided = true;
        intervalSeconds = number;
      } else {
        if (timeoutProvided) throw new TypeError("--timeout-seconds may only be provided once");
        timeoutProvided = true;
        timeoutSeconds = number;
      }
    } else {
      throw new TypeError(`Unsupported argument: ${argument}`);
    }
  }
  if (transactionId === undefined) throw new TypeError("--transaction-id is required");
  if (intervalSeconds < 2) throw new TypeError("--interval-seconds must be at least 2");
  if (timeoutSeconds < intervalSeconds || timeoutSeconds > 3600) throw new TypeError("--timeout-seconds must be between the interval and 3600");
  return { transactionId, wait, intervalSeconds, timeoutSeconds };
}

export async function getWalletTransactionStatus(input: Readonly<{
  gateway: WalletTransactionStatusGateway;
  requestedTransactionId: string;
  configuredWalletId: string;
}>): Promise<SafeWalletTransactionStatus> {
  const requestedTransactionId = uuidSchema.parse(input.requestedTransactionId);
  const transaction = await input.gateway.getTransaction(requestedTransactionId);
  if (transaction.id !== requestedTransactionId) throw new TypeError("Circle transaction response contained a different transaction ID");
  if (transaction.blockchain !== CIRCLE_ARC_TESTNET_BLOCKCHAIN) throw new TypeError(`Circle transaction response contained non-${CIRCLE_ARC_TESTNET_BLOCKCHAIN} data`);
  if (transaction.walletId !== undefined && transaction.walletId !== input.configuredWalletId) throw new TypeError("Circle transaction response contained another wallet");
  const transactionHash = transaction.txHash === undefined ? undefined : transactionHashSchema.parse(transaction.txHash);
  return {
    transactionId: transaction.id,
    blockchain: transaction.blockchain,
    state: transaction.state,
    transactionType: transaction.transactionType,
    ...(transaction.operation === undefined ? {} : { operation: transaction.operation }),
    createDate: transaction.createDate,
    updateDate: transaction.updateDate,
    ...(transactionHash === undefined ? {} : { transactionHash, arcScanUrl: getExplorerTransactionUrl(transactionHash) }),
    ...(transaction.blockHeight === undefined ? {} : { blockHeight: validateBlockHeight(transaction.blockHeight) }),
    ...(transaction.networkFee === undefined ? {} : { networkFee: boundedPublicString(transaction.networkFee) }),
    ...(transaction.errorReason === undefined ? {} : { failureReason: boundedFailureReason(transaction.errorReason) }),
    ...(transaction.sourceAddress === undefined ? {} : { sourceAddress: transaction.sourceAddress }),
    ...(transaction.destinationAddress === undefined ? {} : { destinationAddress: transaction.destinationAddress }),
    ...(transaction.contractAddress === undefined ? {} : { contractAddress: transaction.contractAddress }),
  };
}

export function createCircleWalletTransactionStatusGateway(client: CircleDeveloperControlledWalletsClient): WalletTransactionStatusGateway {
  return {
    async getTransaction(transactionId) {
      return withCircleErrorNormalization("getTransaction", async () => {
        const response = await client.getTransaction({ id: transactionId });
        const transaction = response.data?.transaction;
        if (transaction === undefined) throw new TypeError("Circle getTransaction response did not contain a transaction");
        return transaction;
      });
    },
  };
}

export function formatWalletTransactionStatus(status: SafeWalletTransactionStatus): readonly string[] {
  return [
    `transaction ID: ${status.transactionId}`,
    `blockchain: ${status.blockchain}`,
    `state: ${status.state}`,
    `type: ${status.transactionType}`,
    ...(status.operation === undefined ? [] : [`operation: ${status.operation}`]),
    `created: ${status.createDate}`,
    `updated: ${status.updateDate}`,
    ...(status.transactionHash === undefined ? [] : [`transaction hash: ${status.transactionHash}`, `ArcScan transaction URL: ${status.arcScanUrl}`]),
    ...(status.blockHeight === undefined ? [] : [`block height: ${status.blockHeight}`]),
    ...(status.networkFee === undefined ? [] : [`network fee: ${status.networkFee}`]),
    ...(status.failureReason === undefined ? [] : [`failure reason: ${status.failureReason}`]),
    ...(status.sourceAddress === undefined ? [] : [`source: ${status.sourceAddress}`]),
    ...(status.destinationAddress === undefined ? [] : [`destination: ${status.destinationAddress}`]),
    ...(status.contractAddress === undefined ? [] : [`contract: ${status.contractAddress}`]),
  ];
}

export async function waitForWalletTransactionStatus<T extends Readonly<{ state: string }>>(input: Readonly<{
  retrieve: () => Promise<T>;
  intervalSeconds: number;
  timeoutSeconds: number;
  onChange: (status: T) => void;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}>): Promise<T> {
  const sleep = input.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = input.now ?? Date.now;
  const deadline = now() + input.timeoutSeconds * 1000;
  let previous = "";
  while (true) {
    const status = await input.retrieve();
    if (status.state !== previous) input.onChange(status);
    previous = status.state;
    if (status.state === WALLET_TRANSACTION_SUCCESS_STATE) return status;
    if (WALLET_TRANSACTION_FAILURE_STATES.has(status.state as WalletTransactionFailureState)) throw new TypeError(`Circle wallet transaction reached terminal failure state ${status.state}`);
    if (now() >= deadline) throw new TypeError(`Timed out waiting ${input.timeoutSeconds} seconds for Circle wallet transaction`);
    await sleep(input.intervalSeconds * 1000);
  }
}

function readWaitNumber(value: string, name: string): number {
  if (!/^\d+$/.test(value)) throw new TypeError(`${name} requires an integer value`);
  return Number(value);
}

function validateBlockHeight(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError("Circle transaction response contained an invalid block height");
  return value;
}

function boundedPublicString(value: string): string | undefined {
  return value.length > 200 || /[\u0000-\u001f\u007f]/.test(value) ? undefined : redactString(value);
}

function boundedFailureReason(value: string): string | undefined {
  const safe = boundedPublicString(value)?.trim();
  if (safe === undefined || safe.length === 0 || /authorization|entity[_ -]?secret|ciphertext|request\s*body|0x[0-9a-f]{8,}|[\[{].*[\]}]/i.test(safe.replaceAll("[REDACTED]", ""))) return undefined;
  return safe.length > 500 ? safe.slice(0, 500) : safe;
}