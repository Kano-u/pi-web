import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { formatDurationLabel } = await jiti.import("./duration-format.ts");

test("labels a duration in minutes and seconds once it passes a minute", () => {
  assert.equal(formatDurationLabel(3), "3s");
  assert.equal(formatDurationLabel(59), "59s");
  assert.equal(formatDurationLabel(60), "1m");
  assert.equal(formatDurationLabel(90), "1m 30s");
  assert.equal(formatDurationLabel(600), "10m");
  assert.equal(formatDurationLabel(3599), "59m 59s");
});

test("drops a second unit that carries no information", () => {
  assert.equal(formatDurationLabel(3600), "1h");
  assert.equal(formatDurationLabel(3900), "1h 5m");
  assert.equal(formatDurationLabel(3601), "1h");
});

test("rounds sub-second values and refuses a value that is not a number", () => {
  assert.equal(formatDurationLabel(0.4), "0s");
  assert.equal(formatDurationLabel(59.6), "1m");
  assert.equal(formatDurationLabel(Number.NaN), "");
  assert.equal(formatDurationLabel(Number.POSITIVE_INFINITY), "");
});
