import { test } from "node:test";
import assert from "node:assert/strict";
import { TransformersCrossEncoder } from "./transformers-cross-encoder.js";

// Real-model tests download ~90MB and run slow; opt in with RANKSMITH_MODEL_TESTS=1.
const modelTest = process.env.RANKSMITH_MODEL_TESTS ? test : test.skip;

modelTest("scores a relevant passage higher than an irrelevant one", async () => {
  const ce = new TransformersCrossEncoder();
  const q = "how tall is the Eiffel Tower";
  const relevant = await ce.score(q, "The Eiffel Tower is 330 metres tall.");
  const irrelevant = await ce.score(q, "Bananas are a good source of potassium.");
  assert.ok(relevant > irrelevant, `expected relevant(${relevant}) > irrelevant(${irrelevant})`);
});

modelTest("scoreBatch returns one score per document", async () => {
  const ce = new TransformersCrossEncoder();
  const scores = await ce.scoreBatch("test query", ["doc a", "doc b", "doc c"]);
  assert.equal(scores.length, 3);
  assert.equal(typeof scores[0], "number");
});
