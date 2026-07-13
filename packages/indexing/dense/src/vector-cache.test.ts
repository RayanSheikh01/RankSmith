import { test } from "node:test";
import assert from "node:assert/strict";
import { denseCacheKey } from "./vector-cache.js";

test("denseCacheKey includes version and sanitizes the model name", () => {
  assert.equal(
    denseCacheKey("corpus_1", 1, "Xenova/all-MiniLM-L6-v2"),
    "corpus_1_v1_Xenova_all-MiniLM-L6-v2",
  );
});

test("denseCacheKey keeps hyphens and underscores, replaces other punctuation", () => {
  assert.equal(denseCacheKey("c-2", 3, "hashing-bow-v1"), "c-2_v3_hashing-bow-v1");
});
