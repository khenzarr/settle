import { OrderStatus } from "@settle/shared";

export type ConnectedRole = "disconnected" | "buyer" | "other";
export type OrderPhase = "unknown" | "created" | "funded" | "disputed" | "completed" | "refunded" | "cancelled";
export type BuyerAction = "approve" | "fund" | "none";
export type Workflow = "none" | "buyer-or-operator" | "arbitrator";
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
  | "approval-required"
  | "already-approved"
  | "order-funded"
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
  allowance: bigint;
  requiredAmount: bigint;
  transactionProgress?: TransactionProgress;
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
  lifecycleLabel: string;
  lifecycleMessage: string;
  isTerminal: boolean;
  hasActiveEscrow: boolean;
  workflow: Workflow;
  transactionProgress?: TransactionProgress;
}

const unavailable = (reasonCode: ActionReasonCode, label: string, message: string): BuyerActionState => ({ available: false, reasonCode, label, message });
const available = (label: string, message: string): BuyerActionState => ({ available: true, reasonCode: "approval-required", label, message });

function roleOf(buyer: string, connectedAccount: string | null): ConnectedRole {
  if (!connectedAccount) return "disconnected";
  return buyer.trim().toLowerCase() === connectedAccount.trim().toLowerCase() ? "buyer" : "other";
}

export function projectOrderActionState(input: OrderActionStateInput): OrderActionState {
  const role = roleOf(input.buyer, input.connectedAccount);
  const progress = input.transactionProgress;
  const base = { connectedRole: role, transactionProgress: progress };

  if (input.status === OrderStatus.Created) {
    if (role === "disconnected") {
      return { ...base, phase: "created", primaryBuyerAction: "none", approve: unavailable("wallet-disconnected", "Connect wallet", "Connect the stored buyer wallet to continue."), fund: unavailable("wallet-disconnected", "Connect wallet", "Connect the stored buyer wallet to continue."), lifecycleLabel: "Created", lifecycleMessage: "This order is awaiting buyer funding.", isTerminal: false, hasActiveEscrow: false, workflow: "none" };
    }
    if (role === "other") {
      const message = "Only the exact stored buyer account can approve or fund this order.";
      return { ...base, phase: "created", primaryBuyerAction: "none", approve: unavailable("wrong-buyer-account", "Wrong wallet", message), fund: unavailable("wrong-buyer-account", "Wrong wallet", message), lifecycleLabel: "Created", lifecycleMessage: message, isTerminal: false, hasActiveEscrow: false, workflow: "none" };
    }
    if (!input.fundingDeadlineOpen) {
      const message = "The funding deadline is closed; this unfunded order can no longer be funded.";
      return { ...base, phase: "created", primaryBuyerAction: "none", approve: unavailable("funding-deadline-closed", "Approval unavailable", message), fund: unavailable("funding-deadline-closed", "Funding unavailable", message), lifecycleLabel: "Created", lifecycleMessage: message, isTerminal: false, hasActiveEscrow: false, workflow: "none" };
    }
    if (input.allowance < input.requiredAmount) {
      return { ...base, phase: "created", primaryBuyerAction: "approve", approve: available("Approve", "Approve the exact order amount before funding."), fund: unavailable("approval-required", "Funding unavailable", "Allowance must be at least the exact order amount."), lifecycleLabel: "Created", lifecycleMessage: "Buyer approval is required before funding.", isTerminal: false, hasActiveEscrow: false, workflow: "none" };
    }
    return { ...base, phase: "created", primaryBuyerAction: "fund", approve: unavailable("already-approved", "Already approved", "Allowance is sufficient; no additional approval is needed."), fund: { available: true, reasonCode: "already-approved", label: "Fund", message: "Fund the order from the stored buyer wallet." }, lifecycleLabel: "Created", lifecycleMessage: "The order is ready to be funded.", isTerminal: false, hasActiveEscrow: false, workflow: "none" };
  }

  const terminal = input.status === OrderStatus.Completed || input.status === OrderStatus.Refunded || input.status === OrderStatus.Cancelled;
  const phase: OrderPhase = input.status === OrderStatus.Funded ? "funded" : input.status === OrderStatus.Disputed ? "disputed" : input.status === OrderStatus.Completed ? "completed" : input.status === OrderStatus.Refunded ? "refunded" : input.status === OrderStatus.Cancelled ? "cancelled" : "unknown";
  if (phase === "unknown") {
    const action = unavailable("unsupported-status", "Unavailable", "This order status is not supported; no buyer action is exposed.");
    return { ...base, phase, primaryBuyerAction: "none", approve: action, fund: action, lifecycleLabel: "Unsupported status", lifecycleMessage: action.message, isTerminal: false, hasActiveEscrow: false, workflow: "none" };
  }
  const reason: ActionReasonCode = phase === "funded" ? "order-funded" : phase === "disputed" ? "order-disputed" : "order-terminal";
  const message = phase === "funded" ? "Funds are held in escrow; release or dispute is a protocol capability and is not a browser action in this phase." : phase === "disputed" ? "Escrow remains active; resolution requires an arbitrator workflow." : phase === "cancelled" ? "The unfunded Created order was cancelled; this is not a refund." : `The order is ${phase}.`;
  return { ...base, phase, primaryBuyerAction: "none", approve: unavailable(reason, "Unavailable", message), fund: unavailable(reason, "Unavailable", message), lifecycleLabel: phase[0]!.toUpperCase() + phase.slice(1), lifecycleMessage: message, isTerminal: terminal, hasActiveEscrow: phase === "funded" || phase === "disputed", workflow: phase === "disputed" ? "arbitrator" : phase === "funded" ? "buyer-or-operator" : "none" };
}