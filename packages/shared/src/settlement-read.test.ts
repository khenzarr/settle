import assert from "node:assert/strict";
import test from "node:test";

import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionResult,
  type Hex,
} from "viem";

import { settlementEscrowAbi } from "./abi/SettlementEscrow.ts";
import { ARC_TESTNET } from "./chains.ts";
import { OrderStatus } from "./order.ts";
import { decodeSettlementOrderEvent } from "./settlement-events.ts";
import {
  SettlementReadError,
  createHttpSettlementRpcTransport,
  createSettlementEscrowReader,
  type SettlementRpcTransport,
} from "./settlement-read.ts";

const ORDER_ID = `0x${"11".repeat(32)}` as Hex;
const TERMS_HASH = `0x${"22".repeat(32)}` as Hex;
const TX_HASH = `0x${"33".repeat(32)}`;
const BUYER = "0x1111111111111111111111111111111111111111" as const;
const RECIPIENT_A = "0x2222222222222222222222222222222222222222" as const;
const RECIPIENT_B = "0x3333333333333333333333333333333333333333" as const;
const CHAIN_ID = `0x${ARC_TESTNET.chainId.toString(16)}`;

interface OrderFixture {
  buyer: `0x${string}`;
  totalAmount: bigint;
  fundingDeadline: bigint;
  settlementDeadline: bigint;
  termsHash: Hex;
  createdAt: bigint;
  fundedAt: bigint;
  disputedAt: bigint;
  settledAt: bigint;
  refundedAt: bigint;
  cancelledAt: bigint;
  status: number;
}

function order(overrides: Partial<OrderFixture> = {}): OrderFixture {
  return {
    buyer: BUYER,
    totalAmount: 12_345_678n,
    fundingDeadline: 1_800_000_000n,
    settlementDeadline: 1_900_000_000n,
    termsHash: TERMS_HASH,
    createdAt: 1_700_000_000n,
    fundedAt: 0n,
    disputedAt: 0n,
    settledAt: 0n,
    refundedAt: 0n,
    cancelledAt: 0n,
    status: OrderStatus.Created,
    ...overrides,
  };
}

function functionResult(functionName: "orderExists", result: boolean): Hex;
function functionResult(functionName: "getOrder", result: OrderFixture): Hex;
function functionResult(functionName: "getSettlementSplits", result: readonly [readonly `0x${string}`[], readonly number[]]): Hex;
function functionResult(functionName: "totalActiveEscrow", result: bigint): Hex;
function functionResult(functionName: string, result: unknown): Hex {
  return encodeFunctionResult({ abi: settlementEscrowAbi, functionName: functionName as never, result: result as never });
}

class QueueTransport implements SettlementRpcTransport {
  readonly calls: Array<{ method: string; params: readonly unknown[] }> = [];
  private readonly responses: unknown[];

  constructor(responses: unknown[]) {
    this.responses = responses;
  }

  async request(method: "eth_chainId" | "eth_call", params: readonly unknown[]): Promise<unknown> {
    this.calls.push({ method, params });
    if (this.responses.length === 0) throw new Error("Unexpected RPC request");
    const response = this.responses.shift();
    if (response instanceof Error) throw response;
    return response;
  }
}

function readerFor(
  fixture: OrderFixture,
  recipients: readonly `0x${string}`[] = [RECIPIENT_A, RECIPIENT_B],
  shares: readonly number[] = [6_000, 4_000],
) {
  const transport = new QueueTransport([
    CHAIN_ID,
    functionResult("orderExists", true),
    functionResult("getOrder", fixture),
    functionResult("getSettlementSplits", [recipients, shares]),
  ]);
  return { reader: createSettlementEscrowReader({ transport }), transport };
}

async function projectionFor(fixture: OrderFixture) {
  const result = await readerFor(fixture).reader.readSettlementOrderProjection(ORDER_ID);
  assert.equal(result.kind, "known");
  return result.projection;
}

test("projects a Created order with exact USDC and zero timestamp semantics", async () => {
  const projection = await projectionFor(order());
  assert.equal(projection.totalAmountBaseUnits, 12_345_678n);
  assert.equal(projection.totalAmountUsdc, "12.345678");
  assert.equal(projection.status, OrderStatus.Created);
  assert.equal(projection.rawStatus, 1);
  assert.equal(projection.isCreated, true);
  assert.equal(projection.carriesActiveEscrow, false);
  assert.deepEqual(projection.timestamps, {
    createdAt: 1_700_000_000n,
    fundedAt: null,
    disputedAt: null,
    settledAt: null,
    refundedAt: null,
    cancelledAt: null,
  });
  assert.match(projection.explorer.settlementEscrowAddress, /3e438ae878a8dc02c83f5545047cbde33a4f795f$/);
});

test("preserves uint256 timestamps above the safe integer range as bigint", async () => {
  const unsafeAsNumber = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
  const projection = await projectionFor(order({
    fundingDeadline: unsafeAsNumber,
    settlementDeadline: unsafeAsNumber + 1n,
    createdAt: unsafeAsNumber + 2n,
  }));
  assert.equal(projection.fundingDeadline, unsafeAsNumber);
  assert.equal(projection.settlementDeadline, unsafeAsNumber + 1n);
  assert.equal(projection.createdAt, unsafeAsNumber + 2n);
  assert.equal(projection.timestamps.createdAt, unsafeAsNumber + 2n);
});

test("projects Funded and Disputed orders as active escrow liability", async (t) => {
  await t.test("Funded", async () => {
    const projection = await projectionFor(order({ status: OrderStatus.Funded, fundedAt: 1_700_000_100n }));
    assert.equal(projection.isFunded, true);
    assert.equal(projection.isDisputed, false);
    assert.equal(projection.carriesActiveEscrow, true);
  });
  await t.test("Disputed", async () => {
    const projection = await projectionFor(order({ status: OrderStatus.Disputed, fundedAt: 1n, disputedAt: 2n }));
    assert.equal(projection.isDisputed, true);
    assert.equal(projection.carriesActiveEscrow, true);
  });
});

test("projects Completed, Refunded, and Cancelled orders as terminal without active liability", async (t) => {
  for (const [name, status, timestamp] of [
    ["Completed", OrderStatus.Completed, { settledAt: 3n }],
    ["Refunded", OrderStatus.Refunded, { refundedAt: 4n }],
    ["Cancelled", OrderStatus.Cancelled, { cancelledAt: 5n }],
  ] as const) {
    await t.test(name, async () => {
      const projection = await projectionFor(order({ status, ...timestamp }));
      assert.equal(projection.isTerminal, true);
      assert.equal(projection.carriesActiveEscrow, false);
    });
  }
});

test("uses orderExists for an explicit unknown-order result without reading zero-value structs", async () => {
  const transport = new QueueTransport([CHAIN_ID, functionResult("orderExists", false)]);
  const result = await createSettlementEscrowReader({ transport }).readSettlementOrderProjection(ORDER_ID);
  assert.deepEqual(result, { kind: "unknown", orderId: ORDER_ID, exists: false });
  assert.equal(transport.calls.length, 2);
});

test("projects split payouts with Solidity final-recipient remainder", async () => {
  const { reader } = readerFor(order({ totalAmount: 10_001n }));
  const result = await reader.readSettlementOrderProjection(ORDER_ID);
  assert.equal(result.kind, "known");
  assert.deepEqual(result.projection.settlementSharesBps, [6_000, 4_000]);
  assert.deepEqual(result.projection.expectedPayouts.map((entry) => entry.expectedPayoutBaseUnits), [6_000n, 4_001n]);
});

test("accepts the maximum eight settlement recipients", async () => {
  const recipients = Array.from({ length: 8 }, (_, index) => `0x${String(index + 1).padStart(40, "0")}` as `0x${string}`);
  const shares = [1_250, 1_250, 1_250, 1_250, 1_250, 1_250, 1_250, 1_250];
  const result = await readerFor(order(), recipients, shares).reader.readSettlementOrderProjection(ORDER_ID);
  assert.equal(result.kind, "known");
  assert.equal(result.projection.expectedPayouts.length, 8);
});

test("rejects malformed and invalid settlement splits returned by RPC", async (t) => {
  for (const [name, recipients, shares] of [
    ["no recipients", [], []],
    ["length mismatch", [RECIPIENT_A, RECIPIENT_B], [10_000]],
    ["invalid BPS sum", [RECIPIENT_A, RECIPIENT_B], [5_000, 4_999]],
    ["zero share", [RECIPIENT_A, RECIPIENT_B], [10_000, 0]],
    ["duplicate recipient", [RECIPIENT_A, RECIPIENT_A], [5_000, 5_000]],
    ["zero recipient", ["0x0000000000000000000000000000000000000000", RECIPIENT_B], [5_000, 5_000]],
    [
      "more than eight recipients",
      Array.from({ length: 9 }, (_, index) => `0x${String(index + 1).padStart(40, "0")}` as `0x${string}`),
      [2_000, 1_000, 1_000, 1_000, 1_000, 1_000, 1_000, 1_000, 1_000],
    ],
  ] as const) {
    await t.test(name, async () => {
      await assert.rejects(
        readerFor(order(), recipients, shares).reader.readSettlementOrderProjection(ORDER_ID),
        (error: unknown) => error instanceof SettlementReadError && error.code === "INVALID_SPLITS",
      );
    });
  }
});

test("distinguishes wrong chain, RPC failure, malformed result, ABI failure, and unsupported status", async (t) => {
  await t.test("wrong chain", async () => {
    const reader = createSettlementEscrowReader({ transport: new QueueTransport(["0x1"]) });
    await assert.rejects(reader.readSettlementOrder(ORDER_ID), (error: unknown) => error instanceof SettlementReadError && error.code === "WRONG_CHAIN");
  });
  await t.test("RPC failure", async () => {
    const reader = createSettlementEscrowReader({ transport: new QueueTransport([new Error("offline")]) });
    await assert.rejects(reader.readSettlementOrder(ORDER_ID), (error: unknown) => error instanceof SettlementReadError && error.code === "RPC_FAILURE");
  });
  await t.test("malformed RPC result", async () => {
    const reader = createSettlementEscrowReader({ transport: new QueueTransport([CHAIN_ID, null]) });
    await assert.rejects(reader.readSettlementOrder(ORDER_ID), (error: unknown) => error instanceof SettlementReadError && error.code === "MALFORMED_RPC_RESPONSE");
  });
  await t.test("ABI decode failure", async () => {
    const reader = createSettlementEscrowReader({ transport: new QueueTransport([CHAIN_ID, "0x12"]) });
    await assert.rejects(reader.readSettlementOrder(ORDER_ID), (error: unknown) => error instanceof SettlementReadError && error.code === "ABI_DECODE_FAILURE");
  });
  await t.test("unsupported status", async () => {
    const { reader } = readerFor(order({ status: 7 }));
    await assert.rejects(reader.readSettlementOrderProjection(ORDER_ID), (error: unknown) => error instanceof SettlementReadError && error.code === "UNSUPPORTED_STATUS");
  });
});

test("classifies a JSON-RPC error response as an RPC failure", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    error: { code: -32_000, message: "execution error" },
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  const transport = createHttpSettlementRpcTransport("https://rpc.example.test", fetcher);
  await assert.rejects(
    transport.request("eth_chainId", []),
    (error: unknown) => error instanceof SettlementReadError && error.code === "RPC_FAILURE",
  );
});

test("reader API is frozen and exposes no mutation or signing behavior", () => {
  const reader = createSettlementEscrowReader({ transport: new QueueTransport([]) });
  assert.equal(Object.isFrozen(reader), true);
  assert.deepEqual(Object.keys(reader).sort(), [
    "readSettlementOrder",
    "readSettlementOrderProjection",
    "readSettlementSplits",
    "readTotalActiveEscrow",
    "readTransactionReceipt",
    "readUsdcAllowance",
    "readUsdcBalance",
  ]);
  assert.equal("writeContract" in reader, false);
  assert.equal("sendTransaction" in reader, false);
  assert.equal("sign" in reader, false);
});

function eventLog(
  eventName: "OrderCreated" | "OrderFunded" | "SettlementPaid" | "OrderReleased" | "OrderRefunded" | "OrderCancelled" | "OrderDisputed" | "DisputeResolved",
): { transactionHash: string; blockNumber: bigint; logIndex: bigint; topics: readonly Hex[]; data: Hex } {
  const common = { transactionHash: TX_HASH, blockNumber: 123n, logIndex: 4n };
  const topics = (value: ReturnType<typeof encodeEventTopics>): readonly Hex[] => value as readonly Hex[];
  switch (eventName) {
    case "OrderCreated":
      return {
        ...common,
        topics: topics(encodeEventTopics({ abi: settlementEscrowAbi, eventName, args: { orderId: ORDER_ID, buyer: BUYER } })),
        data: encodeAbiParameters(
          [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes32" }],
          [12_345_678n, 100n, 200n, TERMS_HASH],
        ),
      };
    case "OrderFunded":
      return {
        ...common,
        topics: topics(encodeEventTopics({ abi: settlementEscrowAbi, eventName, args: { orderId: ORDER_ID, buyer: BUYER } })),
        data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [12_345_678n, 300n]),
      };
    case "SettlementPaid":
      return {
        ...common,
        topics: topics(encodeEventTopics({ abi: settlementEscrowAbi, eventName, args: { orderId: ORDER_ID, recipient: RECIPIENT_A } })),
        data: encodeAbiParameters([{ type: "uint256" }], [7_407_406n]),
      };
    case "OrderReleased":
      return {
        ...common,
        topics: topics(encodeEventTopics({ abi: settlementEscrowAbi, eventName, args: { orderId: ORDER_ID, buyer: BUYER } })),
        data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [12_345_678n, 400n]),
      };
    case "OrderRefunded":
      return {
        ...common,
        topics: topics(encodeEventTopics({ abi: settlementEscrowAbi, eventName, args: { orderId: ORDER_ID, buyer: BUYER } })),
        data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [12_345_678n, 500n]),
      };
    case "OrderCancelled":
      return {
        ...common,
        topics: topics(encodeEventTopics({ abi: settlementEscrowAbi, eventName, args: { orderId: ORDER_ID, caller: RECIPIENT_A, buyer: BUYER } })),
        data: encodeAbiParameters([{ type: "uint256" }], [600n]),
      };
    case "OrderDisputed":
      return {
        ...common,
        topics: topics(encodeEventTopics({ abi: settlementEscrowAbi, eventName, args: { orderId: ORDER_ID, caller: RECIPIENT_A, buyer: BUYER } })),
        data: encodeAbiParameters([{ type: "uint256" }], [700n]),
      };
    case "DisputeResolved":
      return {
        ...common,
        topics: topics(encodeEventTopics({ abi: settlementEscrowAbi, eventName, args: { orderId: ORDER_ID, arbitrator: RECIPIENT_B } })),
        data: encodeAbiParameters([{ type: "uint8" }, { type: "uint256" }, { type: "uint256" }], [1, 12_345_678n, 800n]),
      };
  }
}

test("decodes lifecycle events from the generated ABI with public values and evidence", async (t) => {
  const expectedValues = {
    OrderCreated: { buyer: BUYER, totalAmount: 12_345_678n, fundingDeadline: 100n, settlementDeadline: 200n, termsHash: TERMS_HASH },
    OrderFunded: { buyer: BUYER, fundedAmount: 12_345_678n, fundedAt: 300n },
    SettlementPaid: { recipient: RECIPIENT_A, recipientAmount: 7_407_406n },
    OrderReleased: { buyer: BUYER, totalAmount: 12_345_678n, settledAt: 400n },
    OrderRefunded: { buyer: BUYER, refundedAmount: 12_345_678n, refundedAt: 500n },
    OrderCancelled: { caller: RECIPIENT_A, buyer: BUYER, cancelledAt: 600n },
    OrderDisputed: { caller: RECIPIENT_A, buyer: BUYER, disputedAt: 700n },
    DisputeResolved: { arbitrator: RECIPIENT_B, resolution: 1, amount: 12_345_678n, resolvedAt: 800n },
  } as const;

  for (const eventName of ["OrderCreated", "OrderFunded", "SettlementPaid", "OrderReleased", "OrderRefunded", "OrderCancelled", "OrderDisputed", "DisputeResolved"] as const) {
    await t.test(eventName, () => {
      const event = decodeSettlementOrderEvent(eventLog(eventName));
      assert.equal(event.kind, eventName);
      assert.equal(event.orderId, ORDER_ID);
      assert.equal(event.transactionHash, TX_HASH);
      assert.equal(event.blockNumber, 123n);
      assert.equal(event.logIndex, 4n);
      for (const [field, value] of Object.entries(expectedValues[eventName])) {
        assert.equal((event as unknown as Record<string, unknown>)[field], value);
      }
    });
  }
});