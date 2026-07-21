import { test } from "node:test";
import assert from "node:assert/strict";
import { runFingerprint, type FingerprintInput } from "./fingerprint.js";
import type { RunConfigRecord } from "./models.js";

function baseConfig(): RunConfigRecord {
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

function baseInput(): FingerprintInput {
  return {
    config: baseConfig(),
    corpusChecksum: "abc123",
    querySetId: "qs_1",
    evalK: 10,
  };
}

test("identical inputs produce an identical fingerprint", () => {
  assert.equal(runFingerprint(baseInput()), runFingerprint(baseInput()));
});

test("a changed retrieval parameter produces a different fingerprint", () => {
  const changed = baseInput();
  changed.config.bm25.k1 = 1.5;
  assert.notEqual(runFingerprint(baseInput()), runFingerprint(changed));
});

test("config id is not part of the identity", () => {
  // The same parameters saved as a second config record must still compare equal,
  // otherwise re-creating a config would look like a different experiment.
  const renamed = baseInput();
  renamed.config.id = "cfg_2";
  assert.equal(runFingerprint(baseInput()), runFingerprint(renamed));
});

test("a changed corpus, query set, or evalK produces a different fingerprint", () => {
  const base = runFingerprint(baseInput());
  for (const mutate of [
    (i: FingerprintInput) => (i.corpusChecksum = "different"),
    (i: FingerprintInput) => (i.querySetId = "qs_2"),
    (i: FingerprintInput) => (i.evalK = 5),
  ]) {
    const input = baseInput();
    mutate(input);
    assert.notEqual(runFingerprint(input), base);
  }
});

test("every config field is covered by the fingerprint", () => {
  // Guards the longhand field list in runFingerprint: if a field is added to
  // RunConfigRecord and not wired in, this catches it instead of silently
  // fingerprinting two different configs the same.
  const base = runFingerprint(baseInput());
  const mutations: ((c: RunConfigRecord) => void)[] = [
    (c) => (c.retrievalMode = "dense"),
    (c) => (c.topK = 8),
    (c) => (c.rerankDepth = 2),
    (c) => (c.crossEncoderModel = "lexical-overlap-v1"),
    (c) => (c.bm25.k1 = 2),
    (c) => (c.bm25.b = 0.5),
    (c) => (c.dense.modelName = "other-model"),
    (c) => (c.hybrid.fusionType = "weighted"),
    (c) => (c.hybrid.sparseWeight = 0.7),
    (c) => (c.hybrid.denseWeight = 0.3),
    (c) => (c.hybrid.rrfK = 30),
  ];
  for (const mutate of mutations) {
    const input = baseInput();
    mutate(input.config);
    assert.notEqual(runFingerprint(input), base);
  }
});
