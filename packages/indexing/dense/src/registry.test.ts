import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveEmbedder, knownEmbedderModels } from "./registry.js";
import { HashingEmbedder } from "./embedder.js";
import { TransformersEmbedder } from "./transformers-embedder.js";

test("resolveEmbedder returns HashingEmbedder for hashing-bow-v1", () => {
  assert.ok(resolveEmbedder("hashing-bow-v1") instanceof HashingEmbedder);
});

test("resolveEmbedder returns TransformersEmbedder for the MiniLM name", () => {
  // Construction is lazy — this does NOT load or download the model.
  assert.ok(resolveEmbedder("Xenova/all-MiniLM-L6-v2") instanceof TransformersEmbedder);
});

test("resolveEmbedder throws a helpful error for an unknown model", () => {
  assert.throws(() => resolveEmbedder("nope"), /Unknown embedding model "nope"/);
});

test("knownEmbedderModels lists both registered names", () => {
  const names = knownEmbedderModels();
  assert.ok(names.includes("hashing-bow-v1"));
  assert.ok(names.includes("Xenova/all-MiniLM-L6-v2"));
});
