import { OrderStatus, type PaymentState } from "@settle/shared";

export type CanonicalObservation = { readonly observedState: PaymentState | null };
export type CanonicalTransition = { readonly from: PaymentState; readonly to: PaymentState };

export function observeCanonicalState(
  observation: CanonicalObservation,
  next: PaymentState,
): { readonly observation: CanonicalObservation; readonly transition: CanonicalTransition | null } {
  const transition = observation.observedState && observation.observedState !== next
    ? { from: observation.observedState, to: next }
    : null;
  return { observation: { observedState: next }, transition };
}

export function shouldAnimateCanonicalTransition(
  transition: CanonicalTransition | null,
  reducedMotion: boolean,
): boolean {
  return transition !== null && !reducedMotion;
}

export function paymentStateFromCanonicalOrder(status: string, fundingDeadlineExpired: boolean): PaymentState {
  switch (Number(status)) {
    case OrderStatus.Created: return fundingDeadlineExpired ? "payment-window-expired" : "awaiting-payment";
    case OrderStatus.Funded: return "funded";
    case OrderStatus.Disputed: return "disputed";
    case OrderStatus.Completed: return "completed";
    case OrderStatus.Refunded: return "refunded";
    case OrderStatus.Cancelled: return "cancelled";
    default: throw new Error("Unsupported canonical checkout status");
  }
}