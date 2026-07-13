# Design: Dense vector persistence (index caching)

**Date:** 2026-07-13
**Status:** Approved, pending implementation
**Scope:** Feature #2 — cache per-corpus dense vectors on disk so real-model runs do not re-embed every chunk on every run.

## Problem

`runExperiment` builds the retriever fresh on every run; for dense/hybrid modes this calls `DenseIndex.build`, which embeds every chunk. With the real `Xenova/all-MiniLM-L6-v2` model that embedding pass dominates run latency, and it repeats identically each time the same corpus is run under a different config. Cache the chunk vectors so the embedding pass happens once per (corpus, model).

## Decisions (from brainstorming)

- **Persist to disk** via a `FileRepository`-backed store under `data/indexes/` (reuses the existing JSON repository pattern, survives restarts, fills the currently-unused `data/indexes/` scaffold). Rejected: in-memory only (lost on restart), mem+disk (premature for v0.1).
- **Cache check lives in the orchestrator** behind a small injected `DenseVectorCache` interface, with a new `DenseIndex.fromVectors` constructor. Keeps embedding in one place, keeps `indexing-dense` free of filesystem/storage dependencies, storage stays app-layer. Rejected: caching in the store (duplicates embedder resolution) or inside `DenseIndex.build` (couples the pure index type to persistence).
- **No invalidation.** Corpora are immutable — `createCorpus` always mints a new `corpusId` with `version: 1` and chunks never mutate — so a cache hit keyed by `(corpusId, corpusVersion, modelName)` is always valid.

## Components

### `indexing-dense`

```ts
export interface StoredDenseVectors {
  modelName: string;
  dim: number;
  chunkIds: string[];
  docIds: string[];
  vectors: number[][]; // one dim-length row per chunk, JSON-serializable
}

export interface DenseVectorCache {
  get(key: string): Promise<StoredDenseVectors | undefined>;
  put(key: string, value: StoredDenseVectors): Promise<void>;
}

export function denseCacheKey(
  corpusId: string,
  corpusVersion: number,
  modelName: string,
): string; // `${corpusId}_v${corpusVersion}_${modelName.replace(/[^a-zA-Z0-9_-]/g, "_")}`
```

- **`DenseIndex.fromVectors(embedder, stored)`** — new static constructor that builds the index from precomputed vectors (converts each `number[]` row to a `Float32Array` entry). `DenseIndex.build` refactors to `embedBatch` then delegate to the same entry-mapping path. The embedder is still required for embedding the query at retrieve time (one embed per query, not N).

### `apps/api` (`orchestrator.ts`, `store.ts`)

- **`repositoryVectorCache(repo: Repository<StoredDenseVectors>): DenseVectorCache`** — thin adapter (`put` → `save`) so a `FileRepository` satisfies the cache interface without `indexing-dense` importing storage. Lives in `store.ts`.
- `RunInput` gains optional `corpusId?: string`, `corpusVersion?: number`, `denseCache?: DenseVectorCache`.
- `StoreRepositories` gains `vectors: Repository<StoredDenseVectors>`; `fileRepositories()` adds `new FileRepository<StoredDenseVectors>(join(baseDir, "indexes"))`.
- `createRun` passes the corpus identity and the cache adapter into `runExperiment`.

## Data flow

```
createRun
  → runExperiment({ chunks, config, corpusId, corpusVersion, denseCache })
     buildRetriever (dense | hybrid):
       key = denseCacheKey(corpusId, corpusVersion, config.dense.modelName)
       stored = await denseCache.get(key)
       hit  → DenseIndex.fromVectors(embedder, stored)         // skips chunk embedding
       miss → vectors = await embedder.embedBatch(chunkTexts)
              await denseCache.put(key, { modelName, dim, chunkIds, docIds, vectors })
              DenseIndex.fromVectors(embedder, { ...vectors })
```

For hybrid, only the dense half consults the cache; BM25 builds as today.

## Error handling

- **Cache miss, corrupt read, or shape mismatch** — if `stored.dim !== embedder.dim` or `stored.chunkIds.length !== chunks.length`, treat as a miss: recompute and overwrite. Mismatched vectors are never served. (Keys already include the model name, so this is defensive, not expected.)
- **Cache is optional.** When `denseCache`/`corpusId` are absent (existing tests, direct programmatic calls), the orchestrator falls back to `DenseIndex.build` — today's behavior, unchanged.
- The `hashing-bow-v1` baseline is cached through the same path; cheap and harmless, keeps one code path.

## Testing

All tests use `HashingEmbedder` — fast, deterministic, no model download.

- **`fromVectors` correctness** (`indexing-dense`): an index built via `fromVectors` returns the same ranking as one built via `build` for the same corpus.
- **Cache round-trip** (`indexing-dense`): a counting embedder wrapper + an in-memory `DenseVectorCache`; running retrieval twice embeds chunks on the first pass only — assert `embedBatch` call count goes from 1 to 1 (not 2) on the second build. This proves the actual saving.
- **Shape mismatch** (`indexing-dense`): a stored record with the wrong `dim` triggers recompute and overwrite.
- **Orchestrator caching** (`apps/api`): two dense runs over the same corpus with a spy cache — the second run does not embed chunks, and a vectors record is persisted under the expected key.

## Scope

Chunk vectors only. Out of scope: query-embedding cache (single embed, cheap), BM25 index persistence, cache eviction/TTL (corpora immutable, demo-scale disk), and any UI change.

## Note

Even a cache hit loads the model once per process to embed the query, so the first real-model run in a fresh process still pays model-load latency — it just skips the N-chunk embedding pass. Savings scale with corpus size × number of runs per corpus.
