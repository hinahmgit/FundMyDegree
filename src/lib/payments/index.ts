import "server-only";
import { env } from "@/lib/env";
import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  switch (env.paymentProvider()) {
    case "mock":
      provider = new MockPaymentProvider();
      break;
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER "${env.paymentProvider()}"`);
  }
  return provider;
}

export function isTestMode() {
  return env.paymentProvider() === "mock";
}

export type * from "./types";
