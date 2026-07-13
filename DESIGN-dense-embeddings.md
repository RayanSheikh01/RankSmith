# Design: Real dense embeddings (local transformers.js)

**Date:** 2026-07-13
**Status:** Approved, pending implementation
**Scope:** Feature #1 — replace the placeholder dense embedder with a real local model. Index persistence (feature #2) is explicitly out of scope.

## Problem

Dense retrieval currently uses `HashingEmbedder` — a dependency-free hashing-trick stand-in with no semantics. It cannot beat BM25, so the tool's core purpose (comparing sparse vs dense vs hybrid vs reranking) compares a fake against a real baseline. Replace it with real embeddings while keeping the project's local / reproducible / offline ethos.

## Decisions (from brainstorming)

- **Embeddings run locally** via `@xenova/transformers` (ONNX in-process). No API key, no network at run time, reproducible. Rejected: hosted API embedders (break the offline/reproducible property).
- **Keep `HashingEmbedder`** as a selectable fast/zero-download baseline. Both live behind an embedder registry keyed by model name. Seeing hashing lose to a real model is itself a useful demo.
- **Model selection via registry** (not an inline orchestrator switch, not pure DI). This connects the already-existing `config.dense.modelName` field to real behavior.
- **Default model:** `Xenova/all-MiniLM-L6-v2` (384-dim, mean-pooled, L2-normalized).

## Components

### `TransformersEmbedder` — `packages/indexing/dense/src/transformers-embedder.ts` (new)
Implements the existing `Embedder` interface.
- Lazy singleton pipeline: load the model once on first `embed`; cache the `Promise<pipeline>` so concurrent and repeat calls reuse it.
- `embed`: `pipeline(text, { pooling: 'mean', normalize: true })` → copy tensor to a `Float32Array`. Output is already L2-normalized, so `dot` equals cosine similarity — matches the `DenseIndex` assumption.
- `embedBatch`: pass the array to the pipeline (transformers.js batches natively); slice one row per input. May fall back to `Promise.all(texts.map(embed))` if simpler.
- `dim = 384`, `modelName = 'Xenova/all-MiniLM-L6-v2'`.

### `EmbedderRegistry` — `packages/indexing/dense/src/registry.ts` (new)
- `Map<string, () => Embedder>` (factory per model name). Seeded:
  - `'hashing-bow-v1' → () => new HashingEmbedder()`
  - `'Xenova/all-MiniLM-L6-v2' → () => new TransformersEmbedder()`
- `resolveEmbedder(modelName): Embedder` — throws a clear error listing known model names when the name is unknown.

## Data flow

```
run config.dense.modelName
   → resolveEmbedder(name)
orchestrator.buildRetriever   (replaces `?? new HashingEmbedder()`)
   → Embedder
DenseIndex.build / HybridRetriever   (unchanged)
```

Orchestrator resolves the default via `input.embedder ?? resolveEmbedder(config.dense.modelName)`. The explicit-injection path stays (tests pass `HashingEmbedder` directly). The default is no longer hardcoded.

## Error handling

- **Unknown model name** → registry throws before any index build (fail fast, error lists valid names). Complements the existing validator, which only checks that `dense.modelName` is non-empty.
- **Model download / load failure** → propagate with a message naming the model and hinting at offline/cache state. **No silent fallback to hashing** — silent degradation would corrupt a comparison run, and knowing which model actually ran is the whole point of the tool.

## Testing

- Existing unit tests stay on `HashingEmbedder` — fast, no download, unchanged.
- **Registry unit test:** known name resolves to the right embedder; unknown name throws. No download.
- **Gated integration test** — `packages/indexing/dense/src/transformers-embedder.test.ts`:
  - Guarded by `if (process.env.RANKSMITH_MODEL_TESTS)` (repo uses the node:test runner via `node --test dist/**/*.test.js` — there is no `skipIf`).
  - Loads the real model and asserts a semantic ordering, e.g. `sim('car','automobile') > sim('car','banana')`.
  - Asserts `dim === 384` and that output vectors are L2-normalized.

## Dependencies / docs

- Add `@xenova/transformers` to `packages/indexing/dense/package.json` dependencies.
- README: note that the first dense run with the real model downloads ~90MB to the transformers.js cache; offline thereafter.

## Out of scope (next steps)

- **Index persistence (feature #2).** With real embeddings, recomputing vectors per run is slow. Caching/persisting dense vectors per corpus snapshot is the natural follow-up but is not part of this change. Real embeddings recompute per run for now — acceptable.
