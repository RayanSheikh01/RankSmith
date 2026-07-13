import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { RunConfigRecord } from "@ranksmith/core";
import { RankSmithStore } from "./store.js";
import { handleRequest, createServer } from "./server.js";

const documents = [
  { path: "/a.md", title: "DB", raw: "an inverted index maps terms to postings for fast keyword search" },
  { path: "/b.md", title: "Cook", raw: "simmer tomato sauce with garlic and basil" },
];

function config(): RunConfigRecord {
  return {
    id: "cfg_1",
    retrievalMode: "bm25",
    bm25: { k1: 1.2, b: 0.75 },
    dense: { modelName: "hashing-bow-v1" },
    hybrid: { fusionType: "rrf", sparseWeight: 0.5, denseWeight: 0.5, rrfK: 60 },
    topK: 4,
    rerankDepth: 0,
    crossEncoderModel: null,
  };
}

test("handleRequest: corpus lifecycle then run", async () => {
  const store = new RankSmithStore();

  const created = await handleRequest(store, "POST", "/corpora", { name: "test", documents });
  assert.equal(created.status, 201);
  const corpusId = (created.payload as { corpus: { id: string } }).corpus.id;

  const list = await handleRequest(store, "GET", "/corpora", undefined);
  assert.equal((list.payload as { corpora: unknown[] }).corpora.length, 1);

  const chunksRes = await handleRequest(store, "GET", `/corpora/${corpusId}/chunks`, undefined);
  assert.ok((chunksRes.payload as { chunks: unknown[] }).chunks.length > 0);

  const record = (await store.getCorpus(corpusId))!;
  const dbChunk = record.chunks.find((c) => c.text.includes("inverted index"))!;

  const run = await handleRequest(store, "POST", "/runs", {
    config: config(),
    corpusId,
    queries: [{ id: "q1", text: "inverted index keyword search", qrels: { [dbChunk.id]: 1 } }],
  });
  assert.equal(run.status, 201);
  const runId = (run.payload as { run: { id: string }; metrics: { mrr: number } }).run.id;
  assert.equal((run.payload as { metrics: { mrr: number } }).metrics.mrr, 1);

  const results = await handleRequest(store, "GET", `/runs/${runId}/results`, undefined);
  assert.equal((results.payload as { results: unknown[] }).results.length, 1);
});

test("handleRequest: validation and not-found errors", async () => {
  const store = new RankSmithStore();
  await assert.rejects(handleRequest(store, "POST", "/corpora", { name: "x" }), /non-empty 'documents'/);
  await assert.rejects(handleRequest(store, "GET", "/runs/nope", undefined), /Unknown run/);
  await assert.rejects(
    handleRequest(store, "POST", "/runs", { config: config(), corpusId: "missing", queries: [] }),
    /Unknown corpusId/,
  );
});

test("createServer serves over HTTP", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const root = await fetch(`http://localhost:${port}/`);
    assert.equal(root.status, 200);
    assert.match(root.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await root.text(), /RankSmith/);

    const health = await fetch(`http://localhost:${port}/health`);
    assert.equal(health.status, 200);
    const json = (await health.json()) as { service: string };
    assert.equal(json.service, "ranksmith-api");

    const post = await fetch(`http://localhost:${port}/corpora`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "http", documents }),
    });
    assert.equal(post.status, 201);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
