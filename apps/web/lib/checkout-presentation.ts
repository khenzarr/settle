import type { PaymentIntentView, PaymentState } from "@settle/shared";

export type CheckoutPresentation = {
  readonly eyebrow: string;
  readonly headline: string;
  readonly description: string;
  readonly tone: "neutral" | "success" | "warning";
  readonly actionOrientation: "create-required" | "payable" | "informational" | "resolved";
};

export function getCheckoutPresentation(intent: Pick<PaymentIntentView, "paymentState">): CheckoutPresentation {
  const presentations: Record<PaymentState, CheckoutPresentation> = {
    planned: {
      eyebrow: "Checkout unavailable",
      headline: "Create the order before payment",
      description: "This plan is not an onchain order yet. No buyer payment action is available.",
      tone: "neutral",
      actionOrientation: "create-required",
    },
    "awaiting-payment": {
      eyebrow: "Payment action",
      headline: "Awaiting buyer payment",
      description: "Know what you are authorizing: the stored buyer wallet can approve and fund the exact order amount.",
      tone: "neutral",
      actionOrientation: "payable",
    },
    "payment-window-expired": {
      eyebrow: "Payment window",
      headline: "Payment window expired",
      description: "This unfunded payment can no longer be made. The canonical order status remains authoritative and is not changed by this presentation state.",
      tone: "warning",
      actionOrientation: "informational",
    },
    funded: {
      eyebrow: "Payment status",
      headline: "Funds secured in escrow",
      description: "The payment is funded and held in escrow; settlement is not yet complete.",
      tone: "neutral",
      actionOrientation: "informational",
    },
    disputed: {
      eyebrow: "Payment status",
      headline: "Dispute active",
      description: "Funds remain held in escrow while an arbitrator resolves the dispute.",
      tone: "warning",
      actionOrientation: "informational",
    },
    completed: {
      eyebrow: "Payment status",
      headline: "Settlement completed",
      description: "The order is resolved and escrow has been released according to the canonical record.",
      tone: "success",
      actionOrientation: "resolved",
    },
    refunded: {
      eyebrow: "Payment status",
      headline: "Payment refunded",
      description: "The escrowed payment was returned to the buyer; settlement to recipients did not complete.",
      tone: "neutral",
      actionOrientation: "resolved",
    },
    cancelled: {
      eyebrow: "Payment status",
      headline: "Order cancelled",
      description: "The order was cancelled before funding. Cancellation is not a refund.",
      tone: "neutral",
      actionOrientation: "resolved",
    },
  };

  return presentations[intent.paymentState];
}