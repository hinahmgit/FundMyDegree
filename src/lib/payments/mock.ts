import type { ChargeRequest, ChargeResult, PaymentProvider, RefundResult } from "./types";

/**
 * Test-mode provider. Simulates outcomes by card number, like real gateways'
 * sandboxes. Never moves money.
 *
 *   4242 4242 4242 4242  → success
 *   4000 0000 0000 0002  → card declined
 *   4000 0000 0000 9995  → insufficient funds
 *   4000 0000 0000 0069  → expired card
 *   4000 0000 0000 0119  → processing error
 */
export const MOCK_TEST_CARDS = {
  success: "4242424242424242",
  declined: "4000000000000002",
  insufficientFunds: "4000000000009995",
  expired: "4000000000000069",
  processingError: "4000000000000119",
} as const;

const UNSUPPORTED = new Set(["IRR", "SYP", "CUP", "KPW", "VES"]);

function luhn(num: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  private processed = new Map<string, ChargeResult>();

  supportsCurrency(currency: string) {
    return /^[A-Z]{3}$/.test(currency) && !UNSUPPORTED.has(currency);
  }

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    const previous = this.processed.get(req.idempotencyKey);
    if (previous) return previous;
    const result = this.decide(req);
    this.processed.set(req.idempotencyKey, result);
    return result;
  }

  private decide(req: ChargeRequest): ChargeResult {
    if (!this.supportsCurrency(req.currency)) {
      return { ok: false, code: "unsupported_currency", message: `Currency ${req.currency} is not supported` };
    }
    if (!(req.amount > 0)) return { ok: false, code: "processing_error", message: "Amount must be positive" };

    if (req.paymentMethod.type !== "card") {
      // Saved tokens are only ever issued for successful test cards.
      if (!req.paymentMethod.token.startsWith("mock_tok_")) {
        return { ok: false, code: "invalid_card", message: "Unknown payment token" };
      }
      const last4 = req.paymentMethod.token.split("_")[2];
      return { ok: true, providerPaymentId: randomId("mock_pay"), brand: "visa", last4 };
    }

    const pm = req.paymentMethod;
    const number = pm.cardNumber.replace(/\D/g, "");
    if (number.length < 12 || !luhn(number)) return { ok: false, code: "invalid_card", message: "Card number is invalid" };
    const now = new Date();
    if (pm.expYear < now.getFullYear() || (pm.expYear === now.getFullYear() && pm.expMonth < now.getMonth() + 1)) {
      return { ok: false, code: "expired_card", message: "Card has expired" };
    }
    switch (number) {
      case MOCK_TEST_CARDS.declined:
        return { ok: false, code: "card_declined", message: "Card was declined" };
      case MOCK_TEST_CARDS.insufficientFunds:
        return { ok: false, code: "insufficient_funds", message: "Insufficient funds" };
      case MOCK_TEST_CARDS.expired:
        return { ok: false, code: "expired_card", message: "Card has expired" };
      case MOCK_TEST_CARDS.processingError:
        return { ok: false, code: "processing_error", message: "Processing error, try again" };
    }
    const last4 = number.slice(-4);
    return {
      ok: true,
      providerPaymentId: randomId("mock_pay"),
      brand: number.startsWith("4") ? "visa" : number.startsWith("5") ? "mastercard" : "card",
      last4,
      savedToken: req.savePaymentMethod ? `mock_tok_${last4}_${Math.random().toString(36).slice(2, 10)}` : undefined,
    };
  }

  async refund(providerPaymentId: string): Promise<RefundResult> {
    if (!providerPaymentId.startsWith("mock_pay_")) return { ok: false, message: "Unknown payment" };
    return { ok: true, providerRefundId: randomId("mock_ref") };
  }
}
