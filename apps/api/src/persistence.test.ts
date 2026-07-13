import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunConfigRecord } from "@ranksmith/core";
import { RankSmithStore, fileRepositories } from "./store.js";

function config(): RunConfigRecord {
  return {
    id: "cfg_1",
    retrievalMode: "hybrid",
    bm25: { k1: 1.2, b: 0.75 },
    dense: { modelName: "hashing-bow-v1" },
    hybrid: { fusionType: "rrf", sparseWeight: 0.5, denseWeight: 0.5, rrfK: 60 },
    topK: 4,
    rerankDepth: 2,
    crossEncoderModel: "lexical-overlap-v1",
  };
}

test("corpora and runs persist across store instances via the filesystem", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ranksmith-persist-"));
  try {
    const writer = new RankSmithStore(fileRepositories(dir));
    const corpus = await writer.createCorpus(
      "persisted",
      [{ path: "/a.md", title: "DB", raw: "an inverted index maps terms to postings for fast keyword search" }],
      { chunkSize: 200, overlap: 0 },
    );
    const dbChunk = corpus.chunks[0];
    const output = await writer.createRun({
      config: config(),
      corpusId: corpus.corpus.id,
      queries: [{ id: "q1", text: "inverted index keyword search", qrels: { [dbChunk.id]: 1 } }],
      commitHash: "abc123",
    });

    // A brand-new store over the same directory must see both artifacts.
    const reader = new RankSmithStore(fileRepositories(dir));
    const reloadedCorpus = await reader.getCorpus(corpus.corpus.id);
    assert.ok(reloadedCorpus, "corpus should persist");
    assert.equal(reloadedCorpus!.chunks.length, corpus.chunks.length);

    const reloadedRun = await reader.getRun(output.run.id);
    assert.ok(reloadedRun, "run should persist");
    assert.equal(reloadedRun!.run.commitHash, "abc123");
    assert.equal(reloadedRun!.metrics.mrr, output.metrics.mrr);
    assert.equal((await reader.listRuns()).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
