import type { Id } from "@ranksmith/core";

/** A single scored candidate returned by any retrieval strategy. */
export interface RetrievedCandidate {
  chunkId: Id;
  docId: Id;
  /** Strategy-native score; higher is better. Scale is strategy-specific. */
  score: number;
  /** 1-based rank within this result list. */
  rank: number;
}

export interface RetrievalRequest {
  queryText: string;
  topK: number;
}

/**
 * Unified retriever contract shared by BM25, dense, and hybrid strategies so
 * downstream reranking and evaluation are strategy-agnostic.
 */
export interface Retriever {
  readonly name: string;
  retrieve(request: RetrievalRequest): Promise<RetrievedCandidate[]>;
}

/** Sort by descending score and assign 1-based ranks; returns a new array. */
export function rankByScore(
  scored: Array<Omit<RetrievedCandidate, "rank">>,
  topK: number,
): RetrievedCandidate[] {
  return [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}
