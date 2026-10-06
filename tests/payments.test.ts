import { test } from "node:test";
import assert from "node:assert/strict";
import { MockPaymentProvider, MOCK_TEST_CARDS } from "../src/lib/payments/mock.ts";

const card = (cardNumber: string) => ({ type: "card" as const, cardNumber, expMonth: 12, expYear: new Date().getFullYear() + 2, cvc: "123", holderName: "Test" });
const base = { amount: 50, currency: "EUR", description: "t" };

test("success card charges and can be saved for renewals", async () => {
  const p = new MockPaymentProvider();
  const r = await p.charge({ ...base, idempotencyKey: "a", paymentMethod: card(MOCK_TEST_CARDS.success), savePaymentMethod: true });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.last4, "4242");
  const again = await p.charge({ ...base, idempotencyKey: "b", paymentMethod: { type: "saved", token: r.savedToken! } });
  assert.equal(again.ok, true);
});

test("simulated failures map to failure codes", async () => {
  const p = new MockPaymentProvider();
  const codes = await Promise.all(
    [MOCK_TEST_CARDS.declined, MOCK_TEST_CARDS.insufficientFunds, MOCK_TEST_CARDS.expired, MOCK_TEST_CARDS.processingError, "1234567890123456"].map(
      async (n, i) => {
        const r = await p.charge({ ...base, idempotencyKey: `f${i}`, paymentMethod: card(n) });
        return r.ok ? "ok" : r.code;
      },
    ),
  );
  assert.deepEqual(codes, ["card_declined", "insufficient_funds", "expired_card", "processing_error", "invalid_card"]);
});

test("works in many currencies, rejects unsupported ones", async () => {
  const p = new MockPaymentProvider();
  for (const currency of ["USD", "GBP", "KES", "INR", "JPY", "BRL"]) assert.equal(p.supportsCurrency(currency), true);
  const r = await p.charge({ ...base, currency: "IRR", idempotencyKey: "irr", paymentMethod: card(MOCK_TEST_CARDS.success) });
  assert.equal(r.ok ? "ok" : r.code, "unsupported_currency");
});

test("charges are idempotent per key", async () => {
  const p = new MockPaymentProvider();
  const a = await p.charge({ ...base, idempotencyKey: "same", paymentMethod: card(MOCK_TEST_CARDS.success) });
  const b = await p.charge({ ...base, idempotencyKey: "same", paymentMethod: card(MOCK_TEST_CARDS.success) });
  assert.deepEqual(a, b);
});
