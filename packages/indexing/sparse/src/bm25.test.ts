import { test } from "node:test";
import assert from "node:assert/strict";
import type { Chunk } from "@ranksmith/core";
import { Bm25Index } from "./bm25.js";

function chunk(id: string, text: string): Chunk {
  return {
    id,
    docId: `doc_${id}`,
    corpusVersion: 1,
    text,
    tokenCount: text.split(/\s+/).length,
    chunkOrder: 0,
    metadata: {},
  };
}

const corpus = [
  chunk("c1", "the cat sat on the mat"),
  chunk("c2", "dogs and cats are common household pets"),
  chunk("c3", "quantum entanglement links distant particles"),
  chunk("c4", "a feline is a cat that likes to nap"),
];

test("BM25 ranks the most relevant chunk first", async () => {
  const index = new Bm25Index(corpus);
  const results = await index.retrieve({ queryText: "cat nap feline", topK: 4 });
  assert.equal(results[0].chunkId, "c4");
  assert.equal(results[0].rank, 1);
});

test("BM25 returns no results when no query term matches", async () => {
  const index = new Bm25Index(corpus);
  const results = await index.retrieve({ queryText: "zzz nonexistent", topK: 4 });
  assert.equal(results.length, 0);
});

test("BM25 respects topK and produces descending scores", async () => {
  const index = new Bm25Index(corpus);
  const results = await index.retrieve({ queryText: "cat", topK: 1 });
  assert.equal(results.length, 1);
  const all = await index.retrieve({ queryText: "cat", topK: 10 });
  for (let i = 1; i < all.length; i++) {
    assert.ok(all[i - 1].score >= all[i].score);
  }
});

test("rarer terms contribute higher idf than common ones", async () => {
  const index = new Bm25Index(corpus);
  // "quantum" appears in 1 doc, "cat" in several -> quantum query more decisive
  const rare = await index.retrieve({ queryText: "quantum", topK: 4 });
  assert.equal(rare[0].chunkId, "c3");
});
