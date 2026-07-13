import type { Chunk } from "@ranksmith/core";
import {
  rankByScore,
  type RetrievalRequest,
  type RetrievedCandidate,
  type Retriever,
} from "@ranksmith/retrieval";
import { dot, type Embedder } from "./embedder.js";
import type { StoredDenseVectors } from "./vector-cache.js";

interface DenseEntry {
  chunkId: string;
  docId: string;
  vector: Float32Array;
}

/**
 * In-memory dense retriever: embeds every chunk once, then scores queries by
 * cosine similarity (dot product over L2-normalized vectors). Implements the
 * shared Retriever contract. Build via `DenseIndex.build`.
 */
export class DenseIndex implements Retriever {
  readonly name = "dense";

  private constructor(
    private readonly embedder: Embedder,
    private readonly entries: DenseEntry[],
  ) {}

  static async build(chunks: Chunk[], embedder: Embedder): Promise<DenseIndex> {
    const vectors = await embedder.embedBatch(chunks.map((c) => c.text));
    return DenseIndex.fromVectors(embedder, {
      modelName: embedder.modelName,
      dim: embedder.dim,
      chunkIds: chunks.map((c) => c.id),
      docIds: chunks.map((c) => c.docId),
      vectors: vectors.map((v) => Array.from(v)),
    });
  }

  /** Build an index from precomputed vectors (e.g. a cache hit). */
  static fromVectors(embedder: Embedder, stored: StoredDenseVectors): DenseIndex {
    const entries: DenseEntry[] = stored.chunkIds.map((chunkId, i) => ({
      chunkId,
      docId: stored.docIds[i],
      vector: Float32Array.from(stored.vectors[i]),
    }));
    return new DenseIndex(embedder, entries);
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievedCandidate[]> {
    const queryVec = await this.embedder.embed(request.queryText);
    const scored = this.entries.map((e) => ({
      chunkId: e.chunkId,
      docId: e.docId,
      score: dot(queryVec, e.vector),
    }));
    // Drop zero-similarity candidates so empty queries return nothing useful.
    return rankByScore(
      scored.filter((s) => s.score > 0),
      request.topK,
    );
  }
}
