import { OrderStatus } from "@settle/shared";
import type { BuyerOperationState } from "./buyer-transaction-progress.ts";

export type ConnectedRole = "disconnected" | "buyer" | "other";
export type OrderPhase = "unknown" | "created" | "funded" | "disputed" | "completed" | "refunded" | "cancelled";
export type BuyerAction = "approve" | "fund" | "cancel" | "dispute" | "none";
export type Workflow = "none" | "customer-funding" | "public-cancellation" | "funded-settlement" | "arbitrator-resolution";
export type TransactionProgress =
  | "submitting"
  | "pending-receipt"
  | "included-awaiting-state"
  | "state-confirmed"
  | "reverted"
  | "error";

export type ActionReasonCode =
  | "wallet-disconnected"
  | "wrong-buyer-account"
  | "funding-deadline-closed"
  | "funding-window-expired"
  | "cancellation-available"
  | "approval-required"
  | "already-approved"
  | "order-funded"
  | "dispute-available"
  | "order-disputed"
  | "order-terminal"
  | "operator-workflow-required"
  | "arbitrator-workflow-required"
  | "unsupported-status";

export interface OrderActionStateInput {
  status: number;
  buyer: string;
  connectedAccount: string | null;
  fundingDeadlineOpen: boolean;
  fundingDeadlineExpired?: boolean;
  allowance: bigint;
  requiredAmount: bigint;
  transactionProgress?: TransactionProgress;
  buyerOperation?: BuyerOperationState;
}

export interface BuyerActionState {
  available: boolean;
  reasonCode: ActionReasonCode;
  label: string;
  message: string;
}

export interface OrderActionState {
  phase: OrderPhase;
  connectedRole: ConnectedRole;
  primaryBuyerAction: BuyerAction;
  approve: BuyerActionState;
  fund: BuyerActionState;
  cancel: BuyerActionState;
  dispute: BuyerActionState;
  operatorRefundAvailable: boolean;
  arbitratorResolutionRequired: boolean;
  lifecycleLabel: string;
  lifecycleMessage: string;
  isTerminal: boolean;
  hasActiveEscrow: boolean;
  workflow: Workflow;
  transactionProgress?: TransactionProgress;
}

const unavailable = (reasonCode: ActionReasonCode, label: string, message: string): BuyerActionState => ({ available: false, reasonCode, label, message });
const available = (label: string, message: string): BuyerActionState => ({ available: true, reasonCode: "approval-required", label, message });
const actionAvailable = (reasonCode: ActionReasonCode, label: string, message: string): BuyerActionState => ({ available: true, reasonCode, label, message });

function roleOf(buyer: string, connectedAccount: string | null): ConnectedRole {
  if (!connectedAccount) return "disconnected";
  return buyer.trim().toLowerCase() === connectedAccount.trim().toLowerCase() ? "buyer" : "other";
}

export function projectOrderActionState(input: OrderActionStateInput): OrderActionState {
  const role = roleOf(input.buyer, input.connectedAccount);
  const progress = input.transactionProgress;
  const base = { connectedRole: role, transactionProgress: progress };
  const noCancel = unavailable("funding-deadline-closed", "Cancellation unavailable", "Cancellation is only available after the funding deadline.");
  const noDispute = unavailable("order-funded", "Dispute unavailable", "A buyer dispute is only available while the order is funded.");

  if (input.status === OrderStatus.Created) {
    if (role === "disconnected") {
      const cancel = input.fundingDeadlineExpired ? unavailable("wallet-disconnected", "Connect wallet", "Connect any wallet to cancel this expired unfunded order.") : noCancel;
      return { ...base, phase: "created", primaryBuyerAction: "none", approve: unavailable("wallet-disconnected", "Connect wallet", "Connect the stored buyer wallet to continue."), fund: unavailable("wallet-disconnected", "Connect wallet", "Connect the stored buyer wallet to continue."), cancel, dispute: noDispute, operatorRefundAvailable: false, arbitratorResolutionRequired: false, lifecycleLabel: "Created", lifecycleMessage: input.fundingDeadlineExpired ? "Funding window expired. This unfunded order can be cancelled." : "This order is awaiting buyer funding.", isTerminal: false, hasActiveEscrow: false, workflow: input.fundingDeadlineExpired ? "public-cancellation" : "customer-funding" };
    }
    if (role === "other") {
      const message = "Only the exact stored buyer account can approve or fund this order.";
      const cancel = input.fundingDeadlineExpired ? actionAvailable("cancellation-available", "Cancel expired order", "Any connected EOA may cancel this expired unfunded order.") : noCancel;
      return { ...base, phase: "created", primaryBuyerAction: cancel.available ? "cancel" : "none", approve: unavailable("wrong-buyer-account", "Wrong wallet", message), fund: unavailable("wrong-buyer-account", "Wrong wallet", message), cancel, dispute: noDispute, operatorRefundAvailable: false, arbitratorResolutionRequired: false, lifecycleLabel: "Created", lifecycleMessage: input.fundingDeadlineExpired ? "Funding window expired. This unfunded order can be cancelled. Cancellation is not a refund." : message, isTerminal: false, hasActiveEscrow: false, workflow: input.fundingDeadlineExpired ? "public-cancellation" : "customer-funding" };
    }
    if (!input.fundingDeadlineOpen) {
      const message = "The funding deadline is closed; this unfunded order can no longer be funded.";
      const cancel = input.fundingDeadlineExpired ? actionAvailable("cancellation-available", "Cancel expired order", "Any connected EOA may cancel this expired unfunded order.") : noCancel;
      return { ...base, phase: "created", primaryBuyerAction: cancel.available ? "cancel" : "none", approve: unavailable("funding-deadline-closed", "Approval unavailable", message), fund: unavailable("funding-deadline-closed", "Funding unavailable", message), cancel, dispute: noDispute, operatorRefundAvailable: false, arbitratorResolutionRequired: false, lifecycleLabel: "Created", lifecycleMessage: input.fundingDeadlineExpired ? "Funding window expired. This unfunded order can be cancelled. Cancellation is not a refund." : message, isTerminal: false, hasActiveEscrow: false, workflow: input.fundingDeadlineExpired ? "public-cancellation" : "customer-funding" };
    }
    if (input.allowance < input.requiredAmount) {
      return { ...base, phase: "created", primaryBuyerAction: "approve", approve: available("Approve", "Approve the exact order amount before funding."), fund: unavailable("approval-required", "Funding unavailable", "Allowance must be at least the exact order amount."), cancel: noCancel, dispute: noDispute, operatorRefundAvailable: false, arbitratorResolutionRequired: false, lifecycleLabel: "Created", lifecycleMessage: "Buyer approval is required before funding.", isTerminal: false, hasActiveEscrow: false, workflow: "customer-funding" };
    }
    return { ...base, phase: "created", primaryBuyerAction: "fund", approve: unavailable("already-approved", "Already approved", "Allowance is sufficient; no additional approval is needed."), fund: { available: true, reasonCode: "already-approved", label: "Fund", message: "Fund the order from the stored buyer wallet." }, cancel: noCancel, dispute: noDispute, operatorRefundAvailable: false, arbitratorResolutionRequired: false, lifecycleLabel: "Created", lifecycleMessage: "The order is ready to be funded.", isTerminal: false, hasActiveEscrow: false, workflow: "customer-funding" };
  }

  const terminal = input.status === OrderStatus.Completed || input.status === OrderStatus.Refunded || input.status === OrderStatus.Cancelled;
  const phase: OrderPhase = input.status === OrderStatus.Funded ? "funded" : input.status === OrderStatus.Disputed ? "disputed" : input.status === OrderStatus.Completed ? "completed" : input.status === OrderStatus.Refunded ? "refunded" : input.status === OrderStatus.Cancelled ? "cancelled" : "unknown";
  if (phase === "unknown") {
    const action = unavailable("unsupported-status", "Unavailable", "This order status is not supported; no buyer action is exposed.");
    return { ...base, phase, primaryBuyerAction: "none", approve: action, fund: action, cancel: action, dispute: action, operatorRefundAvailable: false, arbitratorResolutionRequired: false, lifecycleLabel: "Unsupported status", lifecycleMessage: action.message, isTerminal: false, hasActiveEscrow: false, workflow: "none" };
  }
  const reason: ActionReasonCode = phase === "funded" ? "order-funded" : phase === "disputed" ? "order-disputed" : "order-terminal";
  const message = phase === "funded" ? "Funds are held in active escrow. The stored buyer may raise a dispute; operator release or full refund remains a marketplace workflow." : phase === "disputed" ? "Escrow remains active. An arbitrator must resolve the dispute to Completed or Refunded." : phase === "refunded" ? "The full escrowed amount was returned to the stored buyer." : phase === "cancelled" ? "This order expired before funding and was cancelled. Cancellation is not a refund." : phase === "completed" ? "Settlement completed and escrow is no longer active." : `The order is ${phase}.`;
  const dispute = phase === "funded" && role === "buyer" ? actionAvailable("dispute-available", "Raise dispute", "Raise a dispute while funds remain held in escrow.") : unavailable(role === "other" ? "wrong-buyer-account" : reason, "Dispute unavailable", role === "other" ? "Only the stored buyer may raise a dispute from the browser." : message);
  return { ...base, phase, primaryBuyerAction: dispute.available ? "dispute" : "none", approve: unavailable(reason, "Unavailable", message), fund: unavailable(reason, "Unavailable", message), cancel: unavailable(reason, "Cancellation unavailable", message), dispute, operatorRefundAvailable: phase === "funded", arbitratorResolutionRequired: phase === "disputed", lifecycleLabel: phase[0]!.toUpperCase() + phase.slice(1), lifecycleMessage: message, isTerminal: terminal, hasActiveEscrow: phase === "funded" || phase === "disputed", workflow: phase === "disputed" ? "arbitrator-resolution" : phase === "funded" ? "funded-settlement" : "none" };
}

export function composeBuyerOperationState(state: OrderActionState, operation: BuyerOperationState | null): OrderActionState {
  if (!operation || state.isTerminal) return state;
  if (operation.operation !== "cancel" && state.connectedRole !== "buyer") return state;
  const action = state[operation.operation];
  if (!action.available) return state;
  const suppressed = { ...action, available: false, label: operation.statusLabel, message: operation.statusMessage };
  return { ...state, [operation.operation]: suppressed };
}