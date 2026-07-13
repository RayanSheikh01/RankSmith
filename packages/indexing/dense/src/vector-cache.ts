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
