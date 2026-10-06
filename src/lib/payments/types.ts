// The contract any payment gateway must satisfy. Plug a real gateway in by
// implementing PaymentProvider and registering it in ./index.ts.

export type PaymentMethodInput =
  | { type: "card"; cardNumber: string; expMonth: number; expYear: number; cvc: string; holderName: string }
  | { type: "saved"; token: string }
  /** A token created client-side by a real gateway's hosted fields. */
  | { type: "token"; token: string };

export interface ChargeRequest {
  amount: number;
  currency: string;
  paymentMethod: PaymentMethodInput;
  description: string;
  idempotencyKey: string;
  savePaymentMethod?: boolean;
  metadata?: Record<string, string>;
}

export type ChargeFailureCode =
  | "card_declined"
  | "insufficient_funds"
  | "expired_card"
  | "invalid_card"
  | "unsupported_currency"
  | "processing_error";

export type ChargeResult =
  | { ok: true; providerPaymentId: string; savedToken?: string; brand?: string; last4?: string; raw?: unknown }
  | { ok: false; code: ChargeFailureCode; message: string; raw?: unknown };

export type RefundResult = { ok: true; providerRefundId: string } | { ok: false; message: string };

export interface PaymentProvider {
  readonly name: string;
  supportsCurrency(currency: string): boolean;
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(providerPaymentId: string, amount: number, currency: string): Promise<RefundResult>;
}
