import { test } from "node:test";
import assert from "node:assert/strict";
import { denseCacheKey } from "./vector-cache.js";
import type { Chunk } from "@ranksmith/core";
import type { Embedder } from "./embedder.js";
import { HashingEmbedder } from "./embedder.js";
import { buildDenseIndexCached, type StoredDenseVectors, type DenseVectorCache } from "./vector-cache.js";

test("denseCacheKey includes version and sanitizes the model name", () => {
  assert.equal(
    denseCacheKey("corpus_1", 1, "Xenova/all-MiniLM-L6-v2"),
    "corpus_1_v1_Xenova_all-MiniLM-L6-v2",
  );
});

test("denseCacheKey keeps hyphens and underscores, replaces other punctuation", () => {
  assert.equal(denseCacheKey("c-2", 3, "hashing-bow-v1"), "c-2_v3_hashing-bow-v1");
});

function chunk(id: string, text: string): Chunk {
  return { id, docId: `doc_${id}`, corpusVersion: 1, text, tokenCount: 0, chunkOrder: 0, metadata: {} };
}

class CountingEmbedder implements Embedder {
  readonly modelName = "hashing-bow-v1";
  readonly dim: number;
  batchCalls = 0;
  private readonly inner: HashingEmbedder;
  constructor(dim = 64) {
    this.dim = dim;
    this.inner = new HashingEmbedder(dim);
  }
  embed(text: string) {
    return this.inner.embed(text);
  }
  embedBatch(texts: string[]) {
    this.batchCalls += 1;
    return this.inner.embedBatch(texts);
  }
}

class MemoryVectorCache implements DenseVectorCache {
  readonly store = new Map<string, StoredDenseVectors>();
  async get(key: string) {
    return this.store.get(key);
  }
  async put(key: string, value: StoredDenseVectors) {
    this.store.set(key, value);
  }
}

test("buildDenseIndexCached embeds on a miss and reuses on a hit", async () => {
  const chunks = [chunk("c1", "alpha beta"), chunk("c2", "gamma delta")];
  const embedder = new CountingEmbedder(64);
  const cache = new MemoryVectorCache();

  await buildDenseIndexCached(chunks, embedder, cache, "k1");
  await buildDenseIndexCached(chunks, embedder, cache, "k1");

  assert.equal(embedder.batchCalls, 1, "second build should hit the cache");
  assert.equal(cache.store.get("k1")!.dim, 64);
});

test("buildDenseIndexCached recomputes on a dim mismatch and overwrites", async () => {
  const chunks = [chunk("c1", "alpha beta")];
  const cache = new MemoryVectorCache();
  await cache.put("k1", {
    modelName: "stale",
    dim: 999,
    chunkIds: ["c1"],
    docIds: ["doc_c1"],
    vectors: [[1, 2, 3]],
  });
  const embedder = new CountingEmbedder(64);

  await buildDenseIndexCached(chunks, embedder, cache, "k1");

  assert.equal(embedder.batchCalls, 1, "mismatch must trigger recompute");
  assert.equal(cache.store.get("k1")!.dim, 64, "cache should be overwritten");
});

test("buildDenseIndexCached recomputes when the chunk count changed", async () => {
  const cache = new MemoryVectorCache();
  const embedder = new CountingEmbedder(64);
  await buildDenseIndexCached([chunk("c1", "alpha")], embedder, cache, "k1");
  // Same key, different corpus size — must not serve the stale record.
  await buildDenseIndexCached([chunk("c1", "alpha"), chunk("c2", "beta")], embedder, cache, "k1");
  assert.equal(embedder.batchCalls, 2);
});
