import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { formatDurationLabel, remainingTimeoutSeconds } = await jiti.import("./duration-format.ts");

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

test("counts a shell call's timeout down from the moment it started", () => {
  assert.equal(remainingTimeoutSeconds(90, 1_000_000, 1_000_000), 90);
  assert.equal(remainingTimeoutSeconds(90, 1_000_000, 1_030_000), 60);
  assert.equal(remainingTimeoutSeconds(90, 1_000_000, 1_089_500), 0.5);
  assert.equal(remainingTimeoutSeconds(600, 1_000_000, 1_300_000), 300);
});

test("stops a timed-out call at zero", () => {
  assert.equal(remainingTimeoutSeconds(90, 1_000_000, 1_090_000), 0);
  assert.equal(remainingTimeoutSeconds(90, 1_000_000, 1_500_000), 0);
});

test("never reads more than the timeout, even against a skewed clock", () => {
  // The call's start sits in the browser's future when the server clock runs ahead.
  assert.equal(remainingTimeoutSeconds(90, 1_000_000, 900_000), 90);
  assert.equal(remainingTimeoutSeconds(90, Number.NaN, 1_000_000), 90);
  assert.equal(remainingTimeoutSeconds(90, 1_000_000, Number.NaN), 90);
});
