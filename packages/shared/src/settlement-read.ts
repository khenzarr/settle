import {
  decodeFunctionResult,
  encodeFunctionData,
  isHex,
  type Hex,
} from "viem";

import { settlementEscrowAbi } from "./abi/SettlementEscrow.ts";
import { ARC_TESTNET } from "./chains.ts";
import { formatUsdcAmount } from "./money.ts";
import {
  OrderStatus,
  hasActiveEscrowObligation,
  isTerminalOrderStatus,
  orderStatusLabel,
  parseOrderStatus,
  type OrderStatus as OrderStatusValue,
} from "./order.ts";
import {
  getExplorerAddressUrl,
  getExplorerTokenUrl,
} from "./explorer.ts";
import {
  evmAddressSchema,
  nonZeroEvmAddressSchema,
  normalizeAddress,
  orderIdSchema,
  transactionHashSchema,
  termsHashSchema,
  type EvmAddress,
  type OrderId,
  type TermsHash,
} from "./schemas.ts";
import {
  calculateSettlementPayouts,
  validateSettlementSplits,
  type SettlementSplit,
} from "./settlement.ts";

const erc20BalanceOfAbi = [{
  type: "function",
  name: "balanceOf",
  stateMutability: "view",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ name: "", type: "uint256" }],
}] as const;
const erc20AllowanceAbi = [{ type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] }] as const;

export type SettlementReadErrorCode =
  | "INVALID_CONFIGURATION"
  | "WRONG_CHAIN"
  | "RPC_FAILURE"
  | "MALFORMED_RPC_RESPONSE"
  | "ABI_DECODE_FAILURE"
  | "UNSUPPORTED_STATUS"
  | "INVALID_SPLITS";

export class SettlementReadError extends Error {
  readonly code: SettlementReadErrorCode;
  readonly cause?: unknown;

  constructor(code: SettlementReadErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "SettlementReadError";
    this.code = code;
    this.cause = options.cause;
  }
}

export interface SettlementRpcTransport {
  request(method: string, params: readonly unknown[]): Promise<unknown>;
}

export interface SettlementTransactionReceipt {
  transactionHash: string;
  status: 0 | 1;
  from: EvmAddress;
  to: EvmAddress;
  blockNumber: bigint;
}

export interface SettlementEscrowReaderConfig {
  transport: SettlementRpcTransport;
  settlementEscrowAddress?: string;
  expectedChainId?: number;
  usdcAddress?: string;
}

export interface RawSettlementOrder {
  buyer: EvmAddress;
  totalAmount: bigint;
  fundingDeadline: bigint;
  settlementDeadline: bigint;
  termsHash: TermsHash;
  createdAt: bigint;
  fundedAt: bigint;
  disputedAt: bigint;
  settledAt: bigint;
  refundedAt: bigint;
  cancelledAt: bigint;
  status: number;
}

export interface NormalizedOrderTimestamps {
  createdAt: bigint | null;
  fundedAt: bigint | null;
  disputedAt: bigint | null;
  settledAt: bigint | null;
  refundedAt: bigint | null;
  cancelledAt: bigint | null;
}

export interface SettlementPayoutProjection extends SettlementSplit {
  expectedPayoutBaseUnits: bigint;
  expectedPayoutUsdc: string;
}

export interface SettlementOrderProjection {
  orderId: OrderId;
  exists: true;
  buyer: EvmAddress;
  totalAmountBaseUnits: bigint;
  totalAmountUsdc: string;
  fundingDeadline: bigint;
  settlementDeadline: bigint;
  termsHash: TermsHash;
  createdAt: bigint;
  fundedAt: bigint;
  disputedAt: bigint;
  settledAt: bigint;
  refundedAt: bigint;
  cancelledAt: bigint;
  timestamps: NormalizedOrderTimestamps;
  rawStatus: number;
  status: OrderStatusValue;
  statusLabel: string;
  settlementRecipients: readonly EvmAddress[];
  settlementSharesBps: readonly number[];
  expectedPayouts: readonly SettlementPayoutProjection[];
  isCreated: boolean;
  isFunded: boolean;
  isDisputed: boolean;
  isTerminal: boolean;
  carriesActiveEscrow: boolean;
  explorer: {
    settlementEscrowAddress: string;
    buyerAddress: string;
    usdcToken: string;
  };
}

export type SettlementOrderReadResult =
  | { kind: "known"; orderId: OrderId; exists: true; order: RawSettlementOrder }
  | { kind: "unknown"; orderId: OrderId; exists: false };

export type SettlementSplitsReadResult =
  | { kind: "known"; orderId: OrderId; exists: true; splits: readonly SettlementSplit[] }
  | { kind: "unknown"; orderId: OrderId; exists: false };

export type SettlementOrderProjectionResult =
  | { kind: "known"; orderId: OrderId; exists: true; projection: SettlementOrderProjection }
  | { kind: "unknown"; orderId: OrderId; exists: false };

export interface SettlementEscrowReader {
  readSettlementOrder(orderId: string): Promise<SettlementOrderReadResult>;
  readSettlementSplits(orderId: string): Promise<SettlementSplitsReadResult>;
  readTotalActiveEscrow(): Promise<bigint>;
  readUsdcBalance(account?: string): Promise<bigint>;
  readUsdcAllowance(owner: string, spender?: string): Promise<bigint>;
  readonly readTransactionReceipt?: (hash: string) => Promise<SettlementTransactionReceipt | null>;
  readSettlementOrderProjection(orderId: string): Promise<SettlementOrderProjectionResult>;
}

function rpcQuantity(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) {
    throw new SettlementReadError("MALFORMED_RPC_RESPONSE", `${field} must be a canonical hexadecimal RPC quantity`);
  }
  return BigInt(value);
}

function rpcHex(value: unknown, field: string): Hex {
  if (typeof value !== "string" || !isHex(value)) {
    throw new SettlementReadError("MALFORMED_RPC_RESPONSE", `${field} must be hexadecimal data`);
  }
  return value;
}

function nonNegativeBigint(value: unknown, field: string): bigint {
  if (typeof value !== "bigint" || value < 0n) {
    throw new SettlementReadError("MALFORMED_RPC_RESPONSE", `${field} must be a non-negative bigint`);
  }
  return value;
}

function normalizeTimestamp(value: bigint): bigint | null {
  return value === 0n ? null : value;
}

function canonicalAddress(value: unknown, nonZero = false): EvmAddress {
  return normalizeAddress((nonZero ? nonZeroEvmAddressSchema : evmAddressSchema).parse(value)) as EvmAddress;
}

function abiAddress(value: EvmAddress): `0x${string}` {
  return value as `0x${string}`;
}

function abiBytes32(value: OrderId): `0x${string}` {
  return value as `0x${string}`;
}

function decodeResult<T>(functionName: string, data: Hex): T {
  try {
    return decodeFunctionResult({
      abi: settlementEscrowAbi,
      functionName: functionName as never,
      data,
    }) as T;
  } catch (cause) {
    throw new SettlementReadError("ABI_DECODE_FAILURE", `Unable to decode ${functionName} result`, { cause });
  }
}

function parseRawOrder(value: unknown): RawSettlementOrder {
  if (typeof value !== "object" || value === null) {
    throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "getOrder did not return an order tuple");
  }
  const order = value as Record<string, unknown>;
  let status: number;
  if (typeof order.status !== "number" || !Number.isInteger(order.status)) {
    throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Order status must be an integer");
  }
  status = order.status;
  try {
    parseOrderStatus(status);
  } catch (cause) {
    throw new SettlementReadError("UNSUPPORTED_STATUS", `Unsupported SettlementEscrow order status: ${status}`, { cause });
  }

  try {
    return {
      buyer: canonicalAddress(order.buyer, true),
      totalAmount: nonNegativeBigint(order.totalAmount, "totalAmount"),
      fundingDeadline: nonNegativeBigint(order.fundingDeadline, "fundingDeadline"),
      settlementDeadline: nonNegativeBigint(order.settlementDeadline, "settlementDeadline"),
      termsHash: termsHashSchema.parse(order.termsHash),
      createdAt: nonNegativeBigint(order.createdAt, "createdAt"),
      fundedAt: nonNegativeBigint(order.fundedAt, "fundedAt"),
      disputedAt: nonNegativeBigint(order.disputedAt, "disputedAt"),
      settledAt: nonNegativeBigint(order.settledAt, "settledAt"),
      refundedAt: nonNegativeBigint(order.refundedAt, "refundedAt"),
      cancelledAt: nonNegativeBigint(order.cancelledAt, "cancelledAt"),
      status,
    };
  } catch (cause) {
    if (cause instanceof SettlementReadError) throw cause;
    throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "getOrder returned invalid order fields", { cause });
  }
}

function parseSplits(value: unknown): SettlementSplit[] {
  if (!Array.isArray(value) || value.length !== 2 || !Array.isArray(value[0]) || !Array.isArray(value[1])) {
    throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "getSettlementSplits did not return recipients and shares arrays");
  }
  const [recipients, shares] = value;
  if (recipients.length !== shares.length) {
    throw new SettlementReadError("INVALID_SPLITS", "Settlement recipient and share lengths do not match");
  }
  try {
    return validateSettlementSplits(recipients.map((recipient, index) => ({
      recipient,
      shareBps: shares[index],
    })));
  } catch (cause) {
    throw new SettlementReadError("INVALID_SPLITS", "SettlementEscrow returned invalid settlement splits", { cause });
  }
}

export function createHttpSettlementRpcTransport(rpcUrl: string, fetcher: typeof fetch = fetch): SettlementRpcTransport {
  let url: URL;
  try {
    url = new URL(rpcUrl);
  } catch (cause) {
    throw new SettlementReadError("INVALID_CONFIGURATION", "RPC URL must be a valid HTTP or HTTPS URL", { cause });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SettlementReadError("INVALID_CONFIGURATION", "RPC URL must use HTTP or HTTPS");
  }

  let nextId = 1;
  return Object.freeze({
    async request(method: string, params: readonly unknown[]): Promise<unknown> {
      if (!["eth_chainId", "eth_call", "eth_getCode", "eth_getTransactionReceipt", "eth_blockNumber", "eth_getLogs"].includes(method)) {
        throw new SettlementReadError("INVALID_CONFIGURATION", `Unsupported read-only RPC method: ${method}`);
      }
      let response: Response;
      try {
        response = await fetcher(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
        });
      } catch (cause) {
        throw new SettlementReadError("RPC_FAILURE", `RPC request failed for ${method}`, { cause });
      }
      if (!response.ok) {
        throw new SettlementReadError("RPC_FAILURE", `RPC request failed with HTTP ${response.status}`);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (cause) {
        throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "RPC response was not valid JSON", { cause });
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "RPC response must be an object");
      }
      const envelope = body as Record<string, unknown>;
      if (envelope.error !== undefined) {
        throw new SettlementReadError("RPC_FAILURE", `RPC returned an error for ${method}`, { cause: envelope.error });
      }
      if (!("result" in envelope)) {
        throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "RPC response is missing result");
      }
      return envelope.result;
    },
  });
}

export function createSettlementEscrowReader(config: SettlementEscrowReaderConfig): SettlementEscrowReader {
  const settlementEscrowAddress = canonicalAddress(
    config.settlementEscrowAddress ?? ARC_TESTNET.settlementEscrow.address,
    true,
  );
  const usdcAddress = canonicalAddress(config.usdcAddress ?? ARC_TESTNET.usdc.address, true);
  const expectedChainId = config.expectedChainId ?? ARC_TESTNET.chainId;
  if (!Number.isSafeInteger(expectedChainId) || expectedChainId <= 0) {
    throw new SettlementReadError("INVALID_CONFIGURATION", "Expected chain ID must be a positive safe integer");
  }

  async function request(method: "eth_chainId" | "eth_call" | "eth_getTransactionReceipt", params: readonly unknown[]): Promise<unknown> {
    try {
      return await config.transport.request(method, params);
    } catch (cause) {
      if (cause instanceof SettlementReadError) throw cause;
      throw new SettlementReadError("RPC_FAILURE", `RPC transport failed for ${method}`, { cause });
    }
  }

  async function assertChain(): Promise<void> {
    const actualChainId = rpcQuantity(await request("eth_chainId", []), "eth_chainId result");
    if (actualChainId !== BigInt(expectedChainId)) {
      throw new SettlementReadError(
        "WRONG_CHAIN",
        `SettlementEscrow reader expected chain ${expectedChainId} but RPC returned ${actualChainId}`,
      );
    }
  }

  async function call(address: EvmAddress, data: Hex): Promise<Hex> {
    return rpcHex(await request("eth_call", [{ to: abiAddress(address), data }, "latest"]), "eth_call result");
  }

  async function orderExists(orderId: OrderId): Promise<boolean> {
    const data = encodeFunctionData({ abi: settlementEscrowAbi, functionName: "orderExists", args: [abiBytes32(orderId)] });
    const decoded = decodeResult<unknown>("orderExists", await call(settlementEscrowAddress, data));
    if (typeof decoded !== "boolean") {
      throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "orderExists did not return a boolean");
    }
    return decoded;
  }

  async function readOrderAfterChainCheck(orderId: OrderId): Promise<SettlementOrderReadResult> {
    if (!await orderExists(orderId)) return { kind: "unknown", orderId, exists: false };
    const data = encodeFunctionData({ abi: settlementEscrowAbi, functionName: "getOrder", args: [abiBytes32(orderId)] });
    const order = parseRawOrder(decodeResult<unknown>("getOrder", await call(settlementEscrowAddress, data)));
    return { kind: "known", orderId, exists: true, order };
  }

  async function readSplitsAfterExistenceCheck(orderId: OrderId): Promise<SettlementSplit[]> {
    const data = encodeFunctionData({ abi: settlementEscrowAbi, functionName: "getSettlementSplits", args: [abiBytes32(orderId)] });
    return parseSplits(decodeResult<unknown>("getSettlementSplits", await call(settlementEscrowAddress, data)));
  }

  const reader: SettlementEscrowReader = {
    async readSettlementOrder(value) {
      const orderId = orderIdSchema.parse(value);
      await assertChain();
      return readOrderAfterChainCheck(orderId);
    },

    async readSettlementSplits(value) {
      const orderId = orderIdSchema.parse(value);
      await assertChain();
      if (!await orderExists(orderId)) return { kind: "unknown", orderId, exists: false };
      return { kind: "known", orderId, exists: true, splits: await readSplitsAfterExistenceCheck(orderId) };
    },

    async readTotalActiveEscrow() {
      await assertChain();
      const data = encodeFunctionData({ abi: settlementEscrowAbi, functionName: "totalActiveEscrow" });
      const result = decodeResult<unknown>("totalActiveEscrow", await call(settlementEscrowAddress, data));
      return nonNegativeBigint(result, "totalActiveEscrow");
    },

    async readUsdcBalance(account = settlementEscrowAddress) {
      const parsedAccount = canonicalAddress(account);
      await assertChain();
      const data = encodeFunctionData({ abi: erc20BalanceOfAbi, functionName: "balanceOf", args: [abiAddress(parsedAccount)] });
      let result: unknown;
      try {
        result = decodeFunctionResult({ abi: erc20BalanceOfAbi, functionName: "balanceOf", data: await call(usdcAddress, data) });
      } catch (cause) {
        if (cause instanceof SettlementReadError) throw cause;
        throw new SettlementReadError("ABI_DECODE_FAILURE", "Unable to decode USDC balanceOf result", { cause });
      }
      return nonNegativeBigint(result, "USDC balance");
    },

    async readUsdcAllowance(owner, spender = settlementEscrowAddress) {
      const parsedOwner = canonicalAddress(owner);
      const parsedSpender = canonicalAddress(spender, true);
      await assertChain();
      const data = encodeFunctionData({ abi: erc20AllowanceAbi, functionName: "allowance", args: [abiAddress(parsedOwner), abiAddress(parsedSpender)] });
      let result: unknown;
      try {
        result = decodeFunctionResult({ abi: erc20AllowanceAbi, functionName: "allowance", data: await call(usdcAddress, data) });
      } catch (cause) {
        if (cause instanceof SettlementReadError) throw cause;
        throw new SettlementReadError("ABI_DECODE_FAILURE", "Unable to decode USDC allowance result", { cause });
      }
      return nonNegativeBigint(result, "USDC allowance");
    },

    async readTransactionReceipt(hash): Promise<SettlementTransactionReceipt | null> {
      const requestedHash = transactionHashSchema.parse(hash).toLowerCase();
      await assertChain();
      const value = await request("eth_getTransactionReceipt", [requestedHash]);
      if (value === null) return null;
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Transaction receipt must be an object or null");
      }
      const receipt = value as Record<string, unknown>;
      const receiptHash = transactionHashSchema.safeParse(receipt.transactionHash);
      if (!receiptHash.success || receiptHash.data.toLowerCase() !== requestedHash) {
        throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Transaction receipt hash does not match requested hash");
      }
      const status = rpcQuantity(receipt.status, "receipt status");
      if (status !== 0n && status !== 1n) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Receipt status must be 0x0 or 0x1");
      const blockNumber = rpcQuantity(receipt.blockNumber, "receipt blockNumber");
      return {
        transactionHash: receiptHash.data.toLowerCase(),
        status: status === 1n ? 1 : 0,
        from: canonicalAddress(receipt.from, true),
        to: canonicalAddress(receipt.to, true),
        blockNumber,
      };
    },

    async readSettlementOrderProjection(value) {
      const orderId = orderIdSchema.parse(value);
      await assertChain();
      const orderResult = await readOrderAfterChainCheck(orderId);
      if (orderResult.kind === "unknown") return orderResult;

      const order = orderResult.order;
      const splits = await readSplitsAfterExistenceCheck(orderId);
      const payouts = calculateSettlementPayouts(order.totalAmount, splits);
      const status = parseOrderStatus(order.status);
      const projection: SettlementOrderProjection = {
        orderId,
        exists: true,
        buyer: order.buyer,
        totalAmountBaseUnits: order.totalAmount,
        totalAmountUsdc: formatUsdcAmount(order.totalAmount),
        fundingDeadline: order.fundingDeadline,
        settlementDeadline: order.settlementDeadline,
        termsHash: order.termsHash,
        createdAt: order.createdAt,
        fundedAt: order.fundedAt,
        disputedAt: order.disputedAt,
        settledAt: order.settledAt,
        refundedAt: order.refundedAt,
        cancelledAt: order.cancelledAt,
        timestamps: {
          createdAt: normalizeTimestamp(order.createdAt),
          fundedAt: normalizeTimestamp(order.fundedAt),
          disputedAt: normalizeTimestamp(order.disputedAt),
          settledAt: normalizeTimestamp(order.settledAt),
          refundedAt: normalizeTimestamp(order.refundedAt),
          cancelledAt: normalizeTimestamp(order.cancelledAt),
        },
        rawStatus: order.status,
        status,
        statusLabel: orderStatusLabel(status),
        settlementRecipients: splits.map((split) => split.recipient),
        settlementSharesBps: splits.map((split) => split.shareBps),
        expectedPayouts: splits.map((split, index) => ({
          ...split,
          expectedPayoutBaseUnits: payouts[index]!,
          expectedPayoutUsdc: formatUsdcAmount(payouts[index]!),
        })),
        isCreated: status === OrderStatus.Created,
        isFunded: status === OrderStatus.Funded,
        isDisputed: status === OrderStatus.Disputed,
        isTerminal: isTerminalOrderStatus(status),
        carriesActiveEscrow: hasActiveEscrowObligation(status),
        explorer: {
          settlementEscrowAddress: getExplorerAddressUrl(settlementEscrowAddress),
          buyerAddress: getExplorerAddressUrl(order.buyer),
          usdcToken: getExplorerTokenUrl(usdcAddress),
        },
      };
      return { kind: "known", orderId, exists: true, projection };
    },
  };

  return Object.freeze(reader);
}