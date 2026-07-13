import { test } from "node:test";
import assert from "node:assert/strict";
import type { RetrievedCandidate } from "@ranksmith/retrieval";
import { LexicalCrossEncoder } from "./cross-encoder.js";
import { rerankCandidates } from "./rerank.js";

function cand(chunkId: string, rank: number): RetrievedCandidate {
  return { chunkId, docId: `doc_${chunkId}`, rank, score: 1 / rank };
}

const texts: Record<string, string> = {
  c1: "the weather today is mild and sunny",
  c2: "transformer models power modern nlp reranking",
  c3: "a short note about cats",
};

const lookup = (id: string) => texts[id];

test("LexicalCrossEncoder scores a relevant pair higher", async () => {
  const enc = new LexicalCrossEncoder();
  const relevant = await enc.score("transformer reranking models", texts.c2);
  const irrelevant = await enc.score("transformer reranking models", texts.c1);
  assert.ok(relevant > irrelevant);
});

test("rerankCandidates reorders the head by cross-encoder score", async () => {
  const enc = new LexicalCrossEncoder();
  // Retrieval put the irrelevant chunk first; reranking should fix it.
  const retrieved = [cand("c1", 1), cand("c2", 2), cand("c3", 3)];
  const reranked = await rerankCandidates("transformer reranking models", retrieved, lookup, enc, 3);
  assert.equal(reranked[0].chunkId, "c2");
  assert.equal(reranked[0].rank, 1);
  assert.equal(reranked[0].retrievalRank, 2);
  assert.ok(reranked[0].rerankScore !== null);
});

test("candidates below depth are left untouched with null rerankScore", async () => {
  const enc = new LexicalCrossEncoder();
  const retrieved = [cand("c2", 1), cand("c1", 2), cand("c3", 3)];
  const reranked = await rerankCandidates("cats", retrieved, lookup, enc, 1);
  assert.equal(reranked.length, 3);
  // Only the head (1 item) was scored; the rest keep order and null score.
  assert.equal(reranked[0].rerankScore !== null, true);
  assert.equal(reranked[1].rerankScore, null);
  assert.equal(reranked[2].rerankScore, null);
  assert.deepEqual(reranked.map((c) => c.rank), [1, 2, 3]);
});
