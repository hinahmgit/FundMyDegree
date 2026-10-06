import { test } from "node:test";
import assert from "node:assert/strict";
import { convert, crossRate } from "../src/lib/fx/convert.ts";

const rates = { USD: 1, EUR: 0.9, KES: 130, JPY: 150 };

test("cross rates go through USD", () => {
  assert.equal(crossRate("USD", "KES", rates), 130);
  assert.ok(Math.abs(crossRate("EUR", "KES", rates)! - 144.444444) < 1e-5);
  assert.equal(crossRate("KES", "KES", rates), 1);
});

test("unknown currencies return null rather than guessing", () => {
  assert.equal(crossRate("USD", "XYZ", rates), null);
  assert.equal(convert(10, "XYZ", "USD", rates), null);
});

test("conversion rounds to cents", () => {
  assert.equal(convert(100, "EUR", "USD", rates), 111.11);
  assert.equal(convert(1000, "JPY", "KES", rates), 866.67);
});
