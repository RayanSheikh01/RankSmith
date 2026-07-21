import type { RetrievedCandidate } from "@ranksmith/retrieval";
import type { CrossEncoder } from "./cross-encoder.js";

export interface RerankedCandidate extends RetrievedCandidate {
  /** Rank this candidate held before reranking. */
  retrievalRank: number;
  /** Cross-encoder score, or null if this candidate was below rerank depth. */
  rerankScore: number | null;
}

export type ChunkTextLookup = (chunkId: string) => string | undefined;

/**
 * Rerank the top `depth` retrieved candidates with a cross-encoder, leaving the
 * remainder in their original order below them. Only the head is re-scored,
 * bounding cross-encoder cost. Ranks are reassigned across the full list.
 */
export async function rerankCandidates(
  query: string,
  candidates: RetrievedCandidate[],
  textOf: ChunkTextLookup,
  encoder: CrossEncoder,
  depth: number,
): Promise<RerankedCandidate[]> {
  const head = candidates.slice(0, Math.max(0, depth));
  const tail = candidates.slice(Math.max(0, depth));

  const scores = await encoder.scoreBatch(
    query,
    head.map((c) => textOf(c.chunkId) ?? ""),
  );

  if (scores.length !== head.length) {
    throw new Error(`Cross-encoder returned ${scores.length} scores for ${head.length} candidates`);
  }
  const rescoredHead = head
    .map((c, i) => ({
      ...c,
      retrievalRank: c.rank,
      rerankScore: scores[i]
    }))
    .sort((a, b) => b.rerankScore - a.rerankScore);
  const passthroughTail: RerankedCandidate[] = tail.map((c) => ({
    ...c,
    retrievalRank: c.rank,
    rerankScore: null,
  }));

  return [...rescoredHead, ...passthroughTail].map((c, i) => ({ ...c, rank: i + 1 }));
}
