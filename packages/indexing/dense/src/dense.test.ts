import { test } from "node:test";
import assert from "node:assert/strict";
import type { Chunk } from "@ranksmith/core";
import { HashingEmbedder, l2NormalizeInPlace, dot } from "./embedder.js";
import { DenseIndex } from "./dense-index.js";

function chunk(id: string, text: string): Chunk {
  return { id, docId: `doc_${id}`, corpusVersion: 1, text, tokenCount: 0, chunkOrder: 0, metadata: {} };
}

test("HashingEmbedder returns unit-norm vectors of the configured dim", async () => {
  const e = new HashingEmbedder(64);
  const v = await e.embed("machine learning models");
  assert.equal(v.length, 64);
  assert.ok(Math.abs(dot(v, v) - 1) < 1e-5);
});

test("embedding is deterministic", async () => {
  const e = new HashingEmbedder(64);
  const a = await e.embed("reproducible embedding");
  const b = await e.embed("reproducible embedding");
  assert.deepEqual(Array.from(a), Array.from(b));
});

test("l2NormalizeInPlace handles the zero vector", () => {
  const z = new Float32Array([0, 0, 0]);
  l2NormalizeInPlace(z);
  assert.deepEqual(Array.from(z), [0, 0, 0]);
});

test("DenseIndex retrieves the lexically-overlapping chunk", async () => {
  const corpus = [
    chunk("c1", "neural networks and deep learning architectures"),
    chunk("c2", "baking sourdough bread at home"),
    chunk("c3", "gardening tips for tomato plants"),
  ];
  const index = await DenseIndex.build(corpus, new HashingEmbedder(512));
  const results = await index.retrieve({ queryText: "deep learning neural networks", topK: 3 });
  assert.equal(results[0].chunkId, "c1");
  assert.equal(results[0].rank, 1);
});

test("DenseIndex returns nothing for a non-overlapping query", async () => {
  const index = await DenseIndex.build([chunk("c1", "alpha beta gamma")], new HashingEmbedder(512));
  const results = await index.retrieve({ queryText: "zzzzz", topK: 3 });
  assert.equal(results.length, 0);
});
