import { test } from "node:test";
import assert from "node:assert/strict";
import { rankByScore } from "./contract.js";
import { tokenize } from "./tokenize.js";

test("rankByScore sorts descending, truncates to topK, and assigns ranks", () => {
  const ranked = rankByScore(
    [
      { chunkId: "c1", docId: "d1", score: 0.2 },
      { chunkId: "c2", docId: "d1", score: 0.9 },
      { chunkId: "c3", docId: "d2", score: 0.5 },
    ],
    2,
  );
  assert.deepEqual(
    ranked.map((c) => c.chunkId),
    ["c2", "c3"],
  );
  assert.deepEqual(
    ranked.map((c) => c.rank),
    [1, 2],
  );
});

test("tokenize lowercases, splits, and drops stopwords and single chars", () => {
  assert.deepEqual(tokenize("The Quick brown-fox, a x!"), ["quick", "brown", "fox"]);
  assert.deepEqual(tokenize("The a of", false), ["the", "of"]);
});
