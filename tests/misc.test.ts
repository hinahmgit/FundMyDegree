import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../src/lib/csv.ts";
import { createTranslator } from "../src/i18n/translate.ts";
import en from "../src/i18n/messages/en.ts";
import { formatDate } from "../src/lib/format.ts";

test("csv escapes quotes and neutralises formulas", () => {
  const csv = toCsv([{ a: 'He said "hi"', b: "=SUM(A1)" }], [{ key: "a", header: "A" }, { key: "b", header: "B" }]);
  assert.equal(csv, 'A,B\n"He said ""hi""",\'=SUM(A1)\n');
});

test("translator interpolates and falls back to the key", () => {
  const t = createTranslator(en);
  assert.equal(t("common.termXofY", { x: 2, y: 8 }), "Term 2 of 8");
  assert.equal(t("nope.missing" as never), "nope.missing");
});

test("dates render in the viewer's time zone; calendar dates do not shift", () => {
  const iso = "2026-03-01T02:30:00Z";
  assert.match(formatDate(iso, "America/Los_Angeles"), /Feb 28, 2026/);
  assert.match(formatDate(iso, "Asia/Tokyo"), /Mar 1, 2026/);
  assert.match(formatDate("2026-03-01", "America/Los_Angeles"), /Mar 1, 2026/);
});

test("date-times include the viewer's zone", async () => {
  const { formatDateTime } = await import("../src/lib/format.ts");
  assert.match(formatDateTime("2026-03-01T02:30:00Z", "Asia/Tokyo"), /Mar 1, 2026.*11:30.*GMT\+9/);
});
