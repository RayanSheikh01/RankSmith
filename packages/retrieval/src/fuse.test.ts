import { test } from "node:test";
import assert from "node:assert/strict";
import { reciprocalRankFusion, weightedFusion, HybridRetriever } from "./fuse.js";
import type { RetrievedCandidate, Retriever, RetrievalRequest } from "./contract.js";

function cand(chunkId: string, rank: number, score: number): RetrievedCandidate {
  return { chunkId, docId: `doc_${chunkId}`, rank, score };
}

function stub(name: string, results: RetrievedCandidate[]): Retriever {
  return {
    name,
    async retrieve(_req: RetrievalRequest) {
      return results;
    },
  };
}

test("RRF rewards candidates ranked highly across both lists", () => {
  const sparse = [cand("a", 1, 9), cand("b", 2, 8), cand("c", 3, 7)];
  const dense = [cand("b", 1, 0.9), cand("a", 2, 0.8), cand("d", 3, 0.7)];
  const fused = reciprocalRankFusion([sparse, dense], 60, 4);
  // a and b appear high in both; they should top the fused list.
  assert.deepEqual(fused.slice(0, 2).map((c) => c.chunkId).sort(), ["a", "b"]);
  assert.equal(fused[0].rank, 1);
});

test("weightedFusion respects the weight balance", () => {
  const sparse = [cand("a", 1, 10), cand("b", 2, 0)];
  const dense = [cand("b", 1, 10), cand("a", 2, 0)];
  const sparseHeavy = weightedFusion(sparse, dense, 0.9, 0.1, 2);
  assert.equal(sparseHeavy[0].chunkId, "a");
  const denseHeavy = weightedFusion(sparse, dense, 0.1, 0.9, 2);
  assert.equal(denseHeavy[0].chunkId, "b");
});

test("HybridRetriever fuses its two backing retrievers via RRF", async () => {
  const sparse = stub("bm25", [cand("a", 1, 9), cand("b", 2, 8)]);
  const dense = stub("dense", [cand("b", 1, 0.9), cand("a", 2, 0.8)]);
  const hybrid = new HybridRetriever(sparse, dense, {
    fusionType: "rrf",
    sparseWeight: 0.5,
    denseWeight: 0.5,
    rrfK: 60,
  });
  const results = await hybrid.retrieve({ queryText: "q", topK: 2 });
  assert.equal(results.length, 2);
  assert.equal(hybrid.name, "hybrid");
});
