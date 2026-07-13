import { test } from "node:test";
import assert from "node:assert/strict";
import type { Chunk, RunConfigRecord } from "@ranksmith/core";
import { ingestDocument } from "@ranksmith/ingestion";
import type { Qrels } from "@ranksmith/evaluation";
import { runExperiment, type EvalQuery } from "./orchestrator.js";

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
