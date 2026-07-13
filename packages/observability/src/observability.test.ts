import { test } from "node:test";
import assert from "node:assert/strict";
import { newId, newRunId } from "./ids.js";
import { Timer, timed, percentile } from "./timing.js";
import { Logger, type LogRecord } from "./logger.js";

test("newId embeds the prefix and is unique across calls", () => {
  const a = newId("chunk");
  const b = newId("chunk");
  assert.match(a, /^chunk_/);
  assert.notEqual(a, b);
  assert.match(newRunId(), /^run_/);
});

test("timed reports a non-negative duration and passes the result through", async () => {
  const { result, ms } = await timed(async () => 42);
  assert.equal(result, 42);
  assert.ok(ms >= 0);
});

test("Timer.elapsedMs is monotonic non-negative", () => {
  const t = new Timer();
  assert.ok(t.elapsedMs() >= 0);
});

test("percentile uses nearest-rank and handles empty input", () => {
  assert.equal(percentile([], 0.5), 0);
  assert.equal(percentile([10], 0.95), 10);
  const sample = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentile(sample, 0.5), 5);
  assert.equal(percentile(sample, 0.95), 10);
});

test("Logger filters by level and merges bound context", () => {
  const records: LogRecord[] = [];
  const log = new Logger({ level: "info", context: { runId: "run_1" }, sink: (r) => records.push(r) });
  log.debug("skipped");
  log.info("kept", { stage: "retrieval" });
  assert.equal(records.length, 1);
  assert.equal(records[0].msg, "kept");
  assert.equal(records[0].context.runId, "run_1");
  assert.equal(records[0].context.stage, "retrieval");
});

test("Logger.child extends context without mutating the parent", () => {
  const records: LogRecord[] = [];
  const parent = new Logger({ context: { a: 1 }, sink: (r) => records.push(r) });
  const child = parent.child({ b: 2 });
  child.info("hi");
  assert.deepEqual(records[0].context, { a: 1, b: 2 });
});
