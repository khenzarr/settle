import { checkoutPath, type PaymentIntentView } from "./payment-intent.ts";
import { orderIdSchema, type EvmAddress, type OrderId } from "./schemas.ts";

export const PAYMENT_HANDOFF_QR_CONTENT_TYPE = "text/uri-list" as const;

export type PaymentHandoff = {
  readonly orderId: OrderId;
  readonly canonicalStatus: PaymentIntentView["canonicalStatus"];
  readonly paymentState: PaymentIntentView["paymentState"];
  readonly buyer: EvmAddress;
  readonly amount: PaymentIntentView["amount"];
  readonly network: PaymentIntentView["network"];
  readonly checkout: {
    readonly path: `/pay/${OrderId}`;
    readonly url: string;
    readonly host: string;
  };
  readonly handoff: {
    readonly available: true;
    readonly paymentActionAvailable: boolean;
    readonly reason?: string;
  };
  readonly qr: {
    readonly payload: string;
    readonly contentType: typeof PAYMENT_HANDOFF_QR_CONTENT_TYPE;
  };
  readonly deeplink: { readonly url: string };
};

export function projectPaymentHandoff(intent: PaymentIntentView, publicOrigin: string): PaymentHandoff {
  if (intent.source !== "onchain" || !intent.checkout.pageAvailable) {
    throw new TypeError("An external payment handoff requires an existing canonical order");
  }

  const orderId = orderIdSchema.parse(intent.orderId);
  const path = checkoutPath(orderId);
  if (intent.checkout.path !== path) throw new TypeError("Payment Intent checkout path is not canonical");

  const origin = new URL(publicOrigin);
  if (origin.origin !== publicOrigin || origin.pathname !== "/" || origin.search !== "" || origin.hash !== "") {
    throw new TypeError("Public application origin must be validated before handoff projection");
  }
  const url = `${origin.origin}${path}`;

  return {
    orderId,
    canonicalStatus: intent.canonicalStatus,
    paymentState: intent.paymentState,
    buyer: intent.buyer,
    amount: intent.amount,
    network: intent.network,
    checkout: { path, url, host: origin.host },
    handoff: {
      available: true,
      paymentActionAvailable: intent.checkout.paymentActionAvailable,
      ...(intent.checkout.reason === undefined ? {} : { reason: intent.checkout.reason }),
    },
    qr: { payload: url, contentType: PAYMENT_HANDOFF_QR_CONTENT_TYPE },
    deeplink: { url },
  };
}