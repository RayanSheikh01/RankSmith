import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCrossEncoder, knownCrossEncoderModels } from "./registry.js";
import { LexicalCrossEncoder } from "./cross-encoder.js";
import { TransformersCrossEncoder } from "./transformers-cross-encoder.js";

test("resolveCrossEncoder returns LexicalCrossEncoder for lexical-overlap-v1", () => {
  assert.ok(resolveCrossEncoder("lexical-overlap-v1") instanceof LexicalCrossEncoder);
});

test("resolveCrossEncoder returns TransformersCrossEncoder for the ms-marco name", () => {
  // Construction is lazy — this does NOT load or download the model.
  assert.ok(
    resolveCrossEncoder("Xenova/ms-marco-MiniLM-L-6-v2") instanceof TransformersCrossEncoder,
  );
});

test("resolveCrossEncoder throws a helpful error for an unknown model", () => {
  assert.throws(() => resolveCrossEncoder("nope"), /Unknown cross-encoder model "nope"/);
});

test("knownCrossEncoderModels lists both registered names", () => {
  const names = knownCrossEncoderModels();
  assert.ok(names.includes("lexical-overlap-v1"));
  assert.ok(names.includes("Xenova/ms-marco-MiniLM-L-6-v2"));
});
