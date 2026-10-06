import { test } from "node:test";
import assert from "node:assert/strict";
import { moderateMessage } from "../src/lib/moderation.ts";

test("allows ordinary messages", () => {
  const r = moderateMessage("Thank you so much! My exams went well, I got 3.7 this semester.");
  assert.equal(r.block, false);
  assert.equal(r.flag, false);
});

test("blocks email addresses, including obfuscated ones", () => {
  assert.ok(moderateMessage("write me at jane.doe@gmail.com").reasons.includes("email"));
  assert.ok(moderateMessage("jane (at) gmail (dot) com").block);
});

test("blocks phone numbers", () => {
  const r = moderateMessage("call me on +254 712 345 678");
  assert.equal(r.block, true);
  assert.ok(r.reasons.includes("phone"));
});

test("blocks IBANs, card numbers and bank wording", () => {
  assert.ok(moderateMessage("GB29 NWBK 6016 1331 9268 19").reasons.includes("iban"));
  assert.ok(moderateMessage("card 4242 4242 4242 4242").reasons.includes("card_number"));
  assert.ok(moderateMessage("my account number is below").reasons.includes("bank_details"));
});

test("flags but does not block off-platform payment talk", () => {
  const r = moderateMessage("can you send it by western union instead?");
  assert.equal(r.block, false);
  assert.equal(r.flag, true);
  assert.deepEqual(r.reasons, ["off_platform"]);
});
