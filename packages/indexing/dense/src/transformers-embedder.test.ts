import { test } from "node:test";
import assert from "node:assert/strict";
import { TransformersEmbedder } from "./transformers-embedder.js";
import { dot } from "./embedder.js";

// Real-model tests download ~90MB and run slow, but always run.
const modelTest = test;

modelTest("TransformersEmbedder returns 384-dim unit-norm vectors", async () => {
  const e = new TransformersEmbedder();
  const v = await e.embed("hello world");
  assert.equal(v.length, 384);
  assert.ok(Math.abs(dot(v, v) - 1) < 1e-3);
});

modelTest("TransformersEmbedder captures semantic similarity", async () => {
  const e = new TransformersEmbedder();
  const [car, automobile, banana] = await e.embedBatch(["car", "automobile", "banana"]);
  assert.ok(dot(car, automobile) > dot(car, banana), "car~automobile should beat car~banana");
});

modelTest("embedBatch returns one vector per input", async () => {
  const e = new TransformersEmbedder();
  const out = await e.embedBatch(["a", "b", "c"]);
  assert.equal(out.length, 3);
  assert.equal(out[0].length, 384);
});
