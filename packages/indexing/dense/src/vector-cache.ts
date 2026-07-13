import type { Chunk } from "@ranksmith/core";
import type { Embedder } from "./embedder.js";
import { DenseIndex } from "./dense-index.js";

/** Persisted dense vectors for one (corpus, model), JSON-serializable. */
export interface StoredDenseVectors {
  modelName: string;
  dim: number;
  chunkIds: string[];
  docIds: string[];
  vectors: number[][];
}

/**
 * Key-value cache for dense chunk vectors. Implemented in the app layer over a
 * storage Repository; kept as an interface here so indexing-dense has no
 * filesystem dependency.
 */
export interface DenseVectorCache {
  get(key: string): Promise<StoredDenseVectors | undefined>;
  put(key: string, value: StoredDenseVectors): Promise<void>;
}

/**
 * Cache key for a corpus/model pair. Corpora are immutable (a new corpus gets a
 * new id), so this key never needs invalidation. The model name is sanitized so
 * the key is safe as a filesystem record id.
 */
export function denseCacheKey(corpusId: string, corpusVersion: number, modelName: string): string {
  const safeModel = modelName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${corpusId}_v${corpusVersion}_${safeModel}`;
}

/**
 * Build a DenseIndex, reusing cached vectors when a valid record exists for the
 * key. A record is valid only if its model and dim match the embedder and it
 * holds one row per chunk; otherwise vectors are recomputed and the cache is
 * overwritten.
 */
export async function buildDenseIndexCached(
  chunks: Chunk[],
  embedder: Embedder,
  cache: DenseVectorCache,
  key: string,
): Promise<DenseIndex> {
  const stored = await cache.get(key);
  if (
    stored &&
    stored.modelName === embedder.modelName &&
    stored.dim === embedder.dim &&
    stored.chunkIds.length === chunks.length
  ) {
    return DenseIndex.fromVectors(embedder, stored);
  }
  const raw = await embedder.embedBatch(chunks.map((c) => c.text));
  const record: StoredDenseVectors = {
    modelName: embedder.modelName,
    dim: embedder.dim,
    chunkIds: chunks.map((c) => c.id),
    docIds: chunks.map((c) => c.docId),
    vectors: raw.map((v) => Array.from(v)),
  };
  await cache.put(key, record);
  return DenseIndex.fromVectors(embedder, record);
}
