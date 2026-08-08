import assert from "node:assert/strict";
import { test } from "node:test";

import { OrderStatus, SettlementEvidenceError, type OrderEvidence } from "@settle/shared";

import {
  loadOrderEvidence,
  OrderEvidenceServiceError,
} from "./order-evidence-service.server.ts";

const orderId = `0x${"ab".repeat(32)}` as const;

const evidence: OrderEvidence = {
  orderId,
  canonicalStatus: OrderStatus.Completed,
  canonicalStatusLabel: "Completed",
  timeline: [],
  settlementPayouts: [],
  summary: {
    expectedAmountBaseUnits: "50000",
    expectedAmountUsdc: "0.050000",
    observedSettlementAmountBaseUnits: "0",
    observedSettlementAmountUsdc: "0.000000",
    payoutCount: 0,
    payoutTotalMatches: false,
  },
  completeness: "partial",
  warnings: ["Settlement payout evidence is unavailable."],
};

test("returns the publication-safe evidence projection unchanged", async () => {
  const result = await loadOrderEvidence(orderId, {
    read: async (requestedOrderId) => {
      assert.equal(requestedOrderId, orderId);
      return evidence;
    },
  });

  assert.deepEqual(result, evidence);
  assert.equal(JSON.stringify(result).includes("topics"), false);
  assert.equal(JSON.stringify(result).includes("data"), false);
});

test("maps known evidence failures to bounded product errors", async () => {
  await assert.rejects(
    loadOrderEvidence(orderId, {
      read: async () => {
        throw new SettlementEvidenceError("WRONG_CHAIN", "The configured RPC is not Arc Testnet.");
      },
    }),
    (error: unknown) => error instanceof OrderEvidenceServiceError
      && error.code === "WRONG_CHAIN"
      && error.message === "The configured RPC is not Arc Testnet.",
  );
});

test("does not publish arbitrary RPC or provider failures", async () => {
  await assert.rejects(
    loadOrderEvidence(orderId, {
      read: async () => {
        throw new Error("provider request body and secret diagnostics");
      },
    }),
    (error: unknown) => error instanceof OrderEvidenceServiceError
      && error.code === "EVIDENCE_UNAVAILABLE"
      && error.message === "Onchain lifecycle evidence is temporarily unavailable."
      && !error.message.includes("provider"),
  );
});