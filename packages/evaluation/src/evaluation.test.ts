import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recallAtK,
  precisionAtK,
  reciprocalRank,
  ndcgAtK,
  computeQueryMetrics,
  type Qrels,
} from "./metrics.js";
import { aggregateMetrics } from "./aggregate.js";

const qrels: Qrels = new Map([
  ["a", 3],
  ["b", 1],
  ["c", 0],
]);

test("recallAtK counts relevant hits over total relevant", () => {
  assert.equal(recallAtK(["a", "c", "b"], qrels, 2), 0.5); // a relevant, b not in top-2
  assert.equal(recallAtK(["a", "b"], qrels, 5), 1);
  assert.equal(recallAtK([], new Map(), 5), 0);
});

test("precisionAtK counts relevant hits over k", () => {
  assert.equal(precisionAtK(["a", "c"], qrels, 2), 0.5);
  assert.equal(precisionAtK(["a", "b"], qrels, 2), 1);
});

test("reciprocalRank finds the first relevant position", () => {
  assert.equal(reciprocalRank(["c", "a", "b"], qrels), 1 / 2);
  assert.equal(reciprocalRank(["c"], qrels), 0);
});

test("ndcgAtK is 1 for the ideal ordering and lower otherwise", () => {
  assert.equal(ndcgAtK(["a", "b"], qrels, 2), 1);
  assert.ok(ndcgAtK(["b", "a"], qrels, 2) < 1);
  assert.equal(ndcgAtK(["x", "y"], qrels, 2), 0);
});

test("computeQueryMetrics bundles all metrics", () => {
  const m = computeQueryMetrics(["a", "b", "c"], qrels, 3);
  assert.equal(m.recall, 1);
  assert.equal(m.reciprocalRank, 1);
  assert.equal(m.ndcg, 1);
});

test("aggregateMetrics averages metrics and computes latency percentiles", () => {
  const agg = aggregateMetrics(
    [
      { recall: 1, precision: 0.5, reciprocalRank: 1, ndcg: 1 },
      { recall: 0, precision: 0, reciprocalRank: 0, ndcg: 0 },
    ],
    [10, 20, 30, 40, 50],
    10,
  );
  assert.equal(agg.queryCount, 2);
  assert.equal(agg.meanRecall, 0.5);
  assert.equal(agg.mrr, 0.5);
  assert.equal(agg.latencyP50Ms, 30);
  assert.equal(agg.latencyP95Ms, 50);
});
