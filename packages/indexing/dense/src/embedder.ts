import { tokenize } from "@ranksmith/retrieval";

/**
 * Produces fixed-dimension embeddings for text. Swap this interface's
 * implementation for a real model (sentence-transformers, an API embedder)
 * without touching the dense index or retrieval code.
 */
export interface Embedder {
  readonly modelName: string;
  readonly dim: number;
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}

/** FNV-1a 32-bit hash for deterministic feature bucketing. */
function fnv1a(token: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Dependency-free embedding via the hashing trick: tokens are hashed into a
 * fixed number of buckets with signed TF weighting, then L2-normalized so cosine
 * similarity reduces to a dot product. Deterministic and reproducible; a stand-in
 * for a learned model that keeps the pipeline fully local.
 */
export class HashingEmbedder implements Embedder {
  readonly modelName: string;
  readonly dim: number;

  constructor(dim = 256, modelName = "hashing-bow-v1") {
    if (dim < 1) throw new Error("dim must be >= 1.");
    this.dim = dim;
    this.modelName = modelName;
  }

  async embed(text: string): Promise<Float32Array> {
    const vec = new Float32Array(this.dim);
    for (const token of tokenize(text)) {
      const h = fnv1a(token);
      const bucket = h % this.dim;
      // Sign bit derived from the hash keeps collisions from always adding.
      const sign = (h & 1) === 0 ? 1 : -1;
      vec[bucket] += sign;
    }
    l2NormalizeInPlace(vec);
    return vec;
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

export function l2NormalizeInPlace(vec: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }
  return vec;
}

/** Dot product; equals cosine similarity for L2-normalized vectors. */
export function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
