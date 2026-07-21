import { test } from "node:test";
import assert from "node:assert/strict";
import type { Chunk, RunConfigRecord } from "@ranksmith/core";
import { ingestDocument } from "@ranksmith/ingestion";
import type { Qrels } from "@ranksmith/evaluation";
import { runExperiment, type EvalQuery } from "./orchestrator.js";
import type { Embedder, StoredDenseVectors, DenseVectorCache } from "@ranksmith/indexing-dense";
import { HashingEmbedder } from "@ranksmith/indexing-dense";

const docs = [
  { title: "ML", text: "neural networks and gradient descent train deep learning models" },
  { title: "Cooking", text: "simmer the tomato sauce with garlic basil and olive oil" },
  { title: "Space", text: "the telescope observed distant galaxies and cosmic background radiation" },
  { title: "Databases", text: "an inverted index maps terms to postings for fast keyword search" },
];

function buildCorpus(): Chunk[] {
  const chunks: Chunk[] = [];
  docs.forEach((d, i) => {
    const { chunks: c } = ingestDocument({
      corpusId: "corpus_1",
      corpusVersion: 1,
      path: `/docs/${i}.md`,
      title: d.title,
      raw: d.text,
      preset: { chunkSize: 50, overlap: 0 },
    });
    chunks.push(...c);
  });
  return chunks;
}

function baseConfig(mode: RunConfigRecord["retrievalMode"], rerankDepth = 0): RunConfigRecord {
  return {
    id: "cfg_1",
    retrievalMode: mode,
    bm25: { k1: 1.2, b: 0.75 },
    dense: { modelName: "hashing-bow-v1" },
    hybrid: { fusionType: "rrf", sparseWeight: 0.5, denseWeight: 0.5, rrfK: 60 },
    topK: 4,
    rerankDepth,
    crossEncoderModel: rerankDepth > 0 ? "lexical-overlap-v1" : null,
  };
}

test("runExperiment produces per-query results and metrics for each mode", async () => {
  const chunks = buildCorpus();
  // Query targets the databases doc; its chunk is the relevant one.
  const dbChunk = chunks.find((c) => c.text.includes("inverted index"))!;
  const qrels: Qrels = new Map([[dbChunk.id, 1]]);
  const queries: EvalQuery[] = [
    { id: "q1", text: "inverted index keyword search postings", qrels },
  ];

  for (const mode of ["bm25", "dense", "hybrid"] as const) {
    const { run, perQuery, metrics } = await runExperiment({
      config: baseConfig(mode),
      chunks,
      queries,
      querySetId: "qs_1",
    });
    assert.equal(run.status, "succeeded");
    assert.match(run.id, /^run_/);
    assert.equal(perQuery.length, 1);
    assert.equal(perQuery[0].candidates[0].chunkId, dbChunk.id, `mode ${mode} should rank db chunk first`);
    assert.equal(metrics.mrr, 1, `mode ${mode} MRR`);
    assert.equal(metrics.queryCount, 1);
  }
});

test("reranking populates rerankScore and latency", async () => {
  const chunks = buildCorpus();
  const spaceChunk = chunks.find((c) => c.text.includes("galaxies"))!;
  const queries: EvalQuery[] = [
    { id: "q1", text: "distant galaxies cosmic radiation telescope", qrels: new Map([[spaceChunk.id, 1]]) },
  ];
  const { perQuery } = await runExperiment({
    config: baseConfig("bm25", 4),
    chunks,
    queries,
    querySetId: "qs_1",
  });
  assert.ok(perQuery[0].rerankLatencyMs >= 0);
  assert.notEqual(perQuery[0].candidates[0].rerankScore, null);
  // Every candidate carries the pre-rerank rank so the UI can show movement.
  assert.ok(perQuery[0].candidates.every((c) => typeof c.retrievalRank === "number"));

  for (const c of perQuery[0].candidates) {
    if (c.chunkId === spaceChunk.id) {
      assert.ok(c.rerankScore! > 0, "relevant chunk should have positive rerank score");
    } else {
      assert.ok(c.rerankScore! <= 0, "irrelevant chunks should have non-positive rerank score");
    }
    assert.notEqual(c.sparseScore, c.rerankScore, "rerankScore should differ from sparse score");
  }
});

test("runExperiment rejects an invalid config", async () => {
  await assert.rejects(
    runExperiment({
      config: { ...baseConfig("bm25"), topK: 0 },
      chunks: buildCorpus(),
      queries: [],
      querySetId: "qs_1",
    }),
    /Invalid run config/,
  );
});

test("runExperiment rejects an unknown dense model", async () => {
  const cfg: RunConfigRecord = { ...baseConfig("dense"), dense: { modelName: "bogus-model" } };
  await assert.rejects(
    runExperiment({ config: cfg, chunks: buildCorpus(), queries: [], querySetId: "qs_1" }),
    /Unknown embedding model "bogus-model"/,
  );
});

test("runExperiment rejects an unknown cross-encoder model", async () => {
  const cfg: RunConfigRecord = { ...baseConfig("bm25", 2), crossEncoderModel: "bogus-reranker" };
  await assert.rejects(
    runExperiment({ config: cfg, chunks: buildCorpus(), queries: [], querySetId: "qs_1" }),
    /Unknown cross-encoder model "bogus-reranker"/,
  );
});

class CountingEmbedder implements Embedder {
  readonly modelName = "hashing-bow-v1";
  readonly dim = 64;
  batchCalls = 0;
  private readonly inner = new HashingEmbedder(64);
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

test("runExperiment caches dense vectors across runs on the same corpus", async () => {
  const chunks = buildCorpus();
  const embedder = new CountingEmbedder();
  const cache = new MemoryVectorCache();
  const input = {
    config: baseConfig("dense"),
    chunks,
    queries: [] as EvalQuery[],
    querySetId: "qs_1",
    embedder,
    denseCache: cache,
    corpusId: "corpus_1",
    corpusVersion: 1,
  };

  await runExperiment(input);
  await runExperiment(input);

  assert.equal(embedder.batchCalls, 1, "second run should reuse cached vectors");
  assert.equal(cache.store.size, 1);
});

test("per-query metrics are recorded per query, not just aggregated", async () => {
  const chunks = buildCorpus();
  const dbChunk = chunks.find((c) => c.text.includes("inverted index"))!;
  const spaceChunk = chunks.find((c) => c.text.includes("telescope"))!;

  // One query the retriever can satisfy, one whose relevant chunk shares no
  // terms with it — so the two queries must not score the same.
  const queries: EvalQuery[] = [
    { id: "hit", text: "inverted index keyword search postings", qrels: new Map([[dbChunk.id, 1]]) },
    { id: "miss", text: "inverted index keyword search postings", qrels: new Map([[spaceChunk.id, 1]]) },
  ];

  const { perQuery, metrics } = await runExperiment({
    config: baseConfig("bm25"),
    chunks,
    queries,
    querySetId: "qs_1",
    evalK: 1,
  });

  assert.equal(perQuery.length, 2);
  assert.equal(perQuery[0].queryId, "hit");
  assert.equal(perQuery[1].queryId, "miss");

  // The whole point: each result carries its own score, so a caller can tell
  // which query regressed instead of only seeing the mean.
  assert.equal(perQuery[0].metrics.ndcg, 1, "relevant chunk ranked first");
  assert.equal(perQuery[1].metrics.ndcg, 0, "relevant chunk not retrieved at k=1");
  assert.equal(perQuery[0].metrics.reciprocalRank, 1);
  assert.equal(perQuery[1].metrics.reciprocalRank, 0);

  // Aggregate stays consistent with the per-query values it came from.
  assert.equal(metrics.meanNdcg, 0.5);
});
